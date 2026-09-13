import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent
TASK=ROOT/'projects/common-ground-ballot'
IMAGE='ballot-verifier:20260914-r10'
summary=[]

def run(name,mode,mutation=None):
    target=OUT/name if mutation else OUT
    target.mkdir(exist_ok=True)
    args=['docker','run','--rm','--network','none']
    for source,dest,ro in [(TASK/'solution','/golden',True),(TASK,'/task',True),(OUT,'/validation',True),(target,'/results',False)]:
        args+=['--mount',f'type=bind,source={source},target={dest}'+(',readonly' if ro else '')]
    if mutation: args+=['-e','LOCAL_MUTATION='+mutation]
    args += [IMAGE,'python3','/validation/run-local.py',mode]
    r=subprocess.run(args,text=True,capture_output=True,encoding='utf-8',errors='replace',timeout=800)
    (OUT/(name+'.log')).write_text(r.stdout+'\n'+r.stderr,encoding='utf-8')
    print(name,'exit',r.returncode,flush=True)
    print(r.stdout[-1800:],flush=True)
    if mutation and mode=='gate':
        data=json.loads((target/'auth-gate-results.json').read_text())
        expected={
            'permissive_password':'wrong_password_rejected',
            'public_collection':'anonymous_read_denied',
            'denial_body_leaks':'denial_body_contains_no_records',
        }[mutation]
        ok=r.returncode!=0 and len(data['results'])==5 and all(not x['passed'] and expected in x['error'] for x in data['results'])
        summary.append(dict(name=name,expected_failure_detected=ok,dimensions_rejected=5,expected_assertion=expected))
        assert ok,(summary[-1],data)
    elif mutation:
        data=json.loads((target/'browser-results.json').read_text())
        failures=[x for x in data['results'] if not x['passed']]
        passed=[x['name'] for x in data['results'] if x['passed']]
        missing={
            'staff_receipt_ignored':'staff success receipts replay seven earlier outcomes without reversing newer state',
            'roster_revision_ignored':'stale ABA roster write is refused and accepted roster reaches two fixed eligibility snapshots',
            'refusal_receipt_forgotten':'durable domain refusals retain original details after changed preconditions and fresh positive controls',
            'eligible_denominator':'partial turnout approval uses one participating Member, not two eligible Members',
            'closed_gate_missing':'Closed boundary refuses eligible unparticipated Member with fresh operation and current revision',
            'vote_replay_rejected':'private single/approval votes, invalid inputs, exact replay, mismatched operation and duplicate participation',
        }[mutation]
        ok=r.returncode!=0 and len(failures)==1 and missing not in passed
        if mutation=='eligible_denominator':
            ok=ok and '50' in failures[0]['error'] and '100' in failures[0]['error']
        if mutation=='closed_gate_missing': ok=ok and '"status":201' in failures[0]['error']
        summary.append(dict(name=name,expected_failure_detected=ok,observed=failures))
        assert ok,summary[-1]
    else:
        summary.append(dict(name=name,passed=r.returncode==0))
        assert r.returncode==0,r.stdout+'\n'+r.stderr

for mode in sys.argv[1:] or ['browser','runtime','harness','mutants','gate-mutants']:
    if mode=='gate-mutants':
        for mutant in ['permissive_password','public_collection','denial_body_leaks']:
            run('negative-'+mutant,'gate',mutant)
    elif mode=='mutants':
        for mutant in ['eligible_denominator','closed_gate_missing','vote_replay_rejected','staff_receipt_ignored','roster_revision_ignored','refusal_receipt_forgotten']:
            run('negative-'+mutant,'browser',mutant)
    else: run(mode,mode)
(OUT/'local-validation-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
