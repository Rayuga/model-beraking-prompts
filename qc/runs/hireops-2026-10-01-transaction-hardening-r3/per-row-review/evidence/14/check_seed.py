"""Independent row 14 checks. Reads frozen inputs; writes only assigned evidence."""
import collections
import datetime
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[6]
TASK = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r3/task'
OUT = Path(__file__).with_name('seed-check-results.json')
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
seed_path = TASK / 'environment/assets/seed_data.json'
s = json.loads(seed_path.read_text(encoding='utf-8'))
failures = []
def check(condition, label):
    if not condition:
        failures.append(label)

parsed = []
for p in TASK.rglob('*'):
    if p.is_file() and p.suffix in {'.json', '.csv', '.tsv'}:
        if p.suffix == '.json':
            json.loads(p.read_text(encoding='utf-8'))
        else:
            import csv
            list(csv.reader(p.open(encoding='utf-8'), delimiter='\t' if p.suffix == '.tsv' else ','))
        parsed.append(p.relative_to(TASK).as_posix())
check(seed_path.read_bytes() == (TASK/'solution/app/src/seed_data.json').read_bytes(), 'seed copies differ')
tables = {}
for name in ['users', 'employees', 'requisitions', 'offers']:
    tables[name] = {r['id']: r for r in s[name]}
    check(len(tables[name]) == len(s[name]), 'duplicate IDs: '+name)
check(len({u['email'].lower() for u in s['users']}) == len(s['users']), 'duplicate emails')
check(all(u['email'].endswith('@hireops.example') for u in s['users']), 'non-example email')
check(all(u['authority_tier'] in [1,2,3] if u['role']=='approver' else u['authority_tier'] is None for u in s['users']), 'authority tier mismatch')
ref_count = 0
for o in s['offers']:
    for field, table in [('req_id','requisitions'),('raised_by','users'),('approved_by','users'),('referred_by','employees')]:
        if o.get(field) is not None:
            ref_count += 1
            check(o[field] in tables[table], o['id']+' missing '+field)
    for k in ['base_salary_cents','signing_bonus_cents','relocation_cents','equity_units','equity_fair_cents','equity_strike_cents']:
        check(type(o[k]) is int and 0 <= o[k] <= 9007199254740991, o['id']+' invalid '+k)
    if o['status'] == 'COMMITTED':
        basis = o['base_salary_cents'] + (o['signing_bonus_cents']+1)//2 + (o['equity_units']*max(0,o['equity_fair_cents']-o['equity_strike_cents'])+2)//4
        tier = 3 if basis >= 35000000 else 2 if basis >= 20000000 else 1
        approver = tables['users'].get(o.get('approved_by'),{})
        check(approver.get('role')=='approver' and approver.get('authority_tier',0)>=tier, o['id']+' approval tier invalid')
        check(o.get('raised_by') != o.get('approved_by'), o['id']+' self approval')
for name in ['seed_commitments','seed_equity_grants','seed_remittances','seed_referral_accruals']:
    for r in s[name]:
        ref_count += 1
        check(r['offer_id'] in tables['offers'], name+' missing offer')
        o = tables['offers'][r['offer_id']]
        check(o['status']=='COMMITTED', name+' non-committed offer')
        if 'req_id' in r:
            ref_count += 1
            check(r['req_id'] in tables['requisitions'] and r['req_id']==o['req_id'], name+' wrong requisition')
        if 'referrer_id' in r:
            ref_count += 1
            check(r['referrer_id'] in tables['employees'] and r['referrer_id']==o['referred_by'], name+' wrong referrer')
for o in s['offers']:
    committed = o['status']=='COMMITTED'
    cs = [r for r in s['seed_commitments'] if r['offer_id']==o['id']]
    run_rate = o['base_salary_cents'] + (o['equity_units']*max(0,o['equity_fair_cents']-o['equity_strike_cents'])+2)//4
    check(len(cs)==int(committed), o['id']+' commitment coverage')
    check(sum(r['movement_cents'] for r in cs)==(-run_rate if committed else 0), o['id']+' commitment amount')
    gs=[r for r in s['seed_equity_grants'] if r['offer_id']==o['id']]
    check(len(gs)==int(committed and o['equity_units']>0), o['id']+' grant coverage')
    for g in gs:
        check((g['units'],g['strike_cents'],g['fair_cents'],g['grant_date'])==(o['equity_units'],o['equity_strike_cents'],o['equity_fair_cents'],o['start_date']), o['id']+' grant terms')
    rs=[r for r in s['seed_remittances'] if r['offer_id']==o['id']]
    check(len(rs)==int(committed and o['signing_bonus_cents']>0), o['id']+' remittance coverage')
    check(sum(r['amount_cents'] for r in rs)==(o['signing_bonus_cents'] if committed else 0), o['id']+' remittance amount')
    fs=[r for r in s['seed_referral_accruals'] if r['offer_id']==o['id']]
    check(len(fs)==int(committed and o['referred_by'] is not None), o['id']+' referral coverage')
    for f in fs:
        check((f['candidate'],f['referred_hire_start'])==(o['candidate'],o['referred_hire_start']), o['id']+' referral details')
headrooms={r['id']:r['budget_cents']+sum(c['movement_cents'] for c in s['seed_commitments'] if c['req_id']==r['id']) for r in s['requisitions']}
check(all(v>=0 for v in headrooms.values()), 'negative initial headroom')
strings=[]
keys=[]
dates=[]
def walk(v,path=''):
    if isinstance(v,dict):
        for k,x in v.items():
            keys.append(k)
            walk(x,path+'/'+k)
    elif isinstance(v,list):
        for i,x in enumerate(v): walk(x,path+'/'+str(i))
    elif isinstance(v,str):
        strings.append((path,v))
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}T.*Z',v):
            datetime.datetime.fromisoformat(v.replace('Z','+00:00'))
            dates.append(path)
walk(s)
check(not any(re.search(r'password|secret|token|api.?key|credential',k,re.I) for k in keys), 'credential field in seed')
payloads=[p for p,v in strings if re.search(r'<script|javascript:|onerror\s*=|ignore (all |previous )?instructions|system prompt|BEGIN .*PRIVATE KEY|sk-(?:proj-)?[A-Za-z0-9]{16}',v,re.I)]
check(not payloads, 'possible injection/secret payload')
index_path=RUN/'raw-evidence-index.json'
index=json.loads(index_path.read_text(encoding='utf-8'))
hash_failures=[]
for e in index['entries']:
    p=ROOT/e['path']
    actual=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
    if actual != e['sha256']: hash_failures.append(e['path'])
result={
 'scope':'Source data parsing, relational/economic consistency, and raw artifact byte verification only; not private deterministic checker or configured judge execution.',
 'input_sha256':index['input_sha256'],
 'seed_sha256':hashlib.sha256(seed_path.read_bytes()).hexdigest(),
 'seed_copies_byte_identical':seed_path.read_bytes()==(TASK/'solution/app/src/seed_data.json').read_bytes(),
 'parsed_files':parsed,'counts':{k:len(v) for k,v in s.items() if isinstance(v,list)},
 'non_null_foreign_references_checked':ref_count,'valid_UTC_instants':len(dates),
 'computed_headroom_cents':headrooms,
 'non_authoritative_planning_scalars':{r['id']:r['stated_headroom_scalar_cents'] for r in s['requisitions']},
 'seed_failures':failures,'payload_scan_hits':payloads,
 'raw_index_sha256':hashlib.sha256(index_path.read_bytes()).hexdigest(),
 'indexed_artifacts_verified':len(index['entries']),'artifact_hash_mismatches':hash_failures,
 'runtime_limitations':index['scope']
}
OUT.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
assert not failures and not hash_failures
