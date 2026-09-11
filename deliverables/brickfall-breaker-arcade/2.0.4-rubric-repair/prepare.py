"""Audit current source against the frozen 2.0.3 ZIP; package one clean task."""
from pathlib import Path
import hashlib,json,re,tomllib,zipfile
from collections import defaultdict
import openpyxl
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[2]
TASK=ROOT/'projects/brickfall-breaker-arcade'; SLUG=TASK.name
PREV=OUT.parent/'2.0.3-verifier-tooling'/f'{SLUG}.zip'
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(PREV) as z: old={n[len(SLUG)+1:]:z.read(n) for n in z.namelist()}
checks=[]
def check(n,v):
    assert v,n
    checks.append(n)
def sha(b):return hashlib.sha256(b).hexdigest()
check('Same clean 30-file inventory',set(files)==set(old) and len(files)==30)
changed={'task.toml','tests/test.sh','tests/functional/judge.toml','tests/functional/prompt.md','tests/polish/judge.toml','tests/polish/prompt.md','environment/assets/instructions/overview.md','environment/assets/instructions/physics.md'}
for n,b in files.items():
    check('Clean member '+n,not set(n.split('/'))&{'node_modules','..','__pycache__','.git'} and Path(n).suffix not in ('.db','.sqlite','.pyc','.zip','.log','.docx'))
    if n.endswith('.xlsx'):check('Workbook unchanged '+n,b==old[n]);continue
    check('LF UTF8 '+n,b'\r' not in b and not b.startswith(b'\xef\xbb\xbf'));s=b.decode()
    check('No credential '+n,not re.search(r'sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}',s))
    if n.endswith('.toml'):tomllib.loads(s)
    if n.endswith('.json'):json.loads(s)
    if n not in changed:check('Only version change '+n,b.replace(b'2.0.4',b'2.0.3')==old[n])
    if '/instructions/' in n:check('Brief <=20 lines '+n,len(s.splitlines())<=20)
t=tomllib.loads(files['task.toml'].decode())
check('Canonical name/version',t['task']['name']=='turing/'+SLUG and t['task']['version']=='2.0.4')
check('Public agent/public separate verifier',t['environment']['network_mode']==t['verifier']['environment']['network_mode']=='public' and t['verifier']['environment_mode']=='separate')
check('Credential placeholder only',t['verifier']['env']==tomllib.loads(old['task.toml'].decode())['verifier']['env'])
counts={};budgets=[];dims={}
for d in ('render','constraints','functional','polish'):
    n=f'tests/{d}/judge.toml';v=tomllib.loads(files[n].decode());o=tomllib.loads(old[n].decode());dims[d]=v;counts[d]=len(v['criterion']);budgets.append(v['judge']['timeout'])
    check('Judge/provider/pins '+d,all(v['judge'][k]==o['judge'][k] for k in ('judge','model','reasoning_effort','temperature','mcp_servers','weight')))
    check('Prompt version and criteria insertion '+d,'2.0.4' in files[f'tests/{d}/prompt.md'].decode() and '{criteria}' in files[f'tests/{d}/prompt.md'].decode())
    check('Positive unique criterion weights '+d,len({c['id'] for c in v['criterion']})==counts[d] and all(c['weight']>0 for c in v['criterion']))
    check('Total criterion weight preserved '+d,sum(c['weight'] for c in v['criterion'])==sum(c['weight'] for c in o['criterion']))
    if d in ('render','constraints'):check('Simple gates unchanged '+d,v==o)
check('33 criteria: 2/2/22/7',counts==dict(render=2,constraints=2,functional=22,polish=7))
newf={c['id']:c for c in dims['functional']['criterion']}
groups={'terminal_finish_history_and_retry':['terminal_finish_and_records','terminal_receipt_retry','terminal_refresh_durability','terminal_keyboard_restart'],'multiball_sticky_and_last_ball':['multiball_secondary_loss','sticky_capture_launch_and_expiry','last_ball_life_loss_cleanup'],'extra_life_and_final_wall':['extra_life_threshold_once','final_wall_completion_bonus']}
for c in tomllib.loads(old['tests/functional/judge.toml'].decode())['criterion']:
    if c['id'] in groups:check('Split preserves weight '+c['id'],sum(newf[n]['weight'] for n in groups[c['id']])==c['weight'])
    else:check('Other Functional criteria untouched '+c['id'],newf[c['id']]==c)
likert=[c for c in dims['polish']['criterion'] if c['type']=='likert']
check('Five anchored craft axes',len(likert)==5 and all(c['points']==5 and all(re.search(s,c['description']) for s in (r'Rate 1',r'3 (when|for)',r'5 (when|for)')) for c in likert))
check('Two objective Polish criteria',len([c for c in dims['polish']['criterion'] if c['type']=='binary'])==2)
check('Six HUD values', 'all six HUD values (score, lives, level, combo, active power-up' in files['tests/polish/judge.toml'].decode())
check('No missing-surface waiver','Score only the surfaces that exist' not in files['tests/polish/judge.toml'].decode())
check('Reward formula/key handling unchanged',files['tests/test.sh'].replace(b'11400',b'6300')==old['tests/test.sh'])
check('Reward weights unchanged',files['tests/reward.toml']==old['tests/reward.toml'])
check('Timeout headroom',sum(budgets)==9860 and 11400-sum(budgets)>=1500 and 11400+120*4.25+30<12600)
check('Six-hour total and <=5h verifier',t['environment']['build_timeout_sec']+t['agent']['timeout_sec']+t['verifier']['timeout_sec']<=21600 and t['verifier']['timeout_sec']<=18000)
# Independent digest derivation from the exact shipped workbook, not the golden function.
w=openpyxl.load_workbook(TASK/'tests/brickfall_seed.xlsx',read_only=True,data_only=True)
rows=iter(w['Bricks'].values);header=next(rows);levels=defaultdict(list)
for row in rows:
    d=dict(zip(header,row));levels[int(d['level'])].append(d)
digests={str(k):sha('|'.join(f"{int(b['row'])}:{int(b['column'])}:{b['type']}:{b['drop'] or ''}" for b in sorted(v,key=lambda b:(b['row'],b['column']))).encode()) for k,v in levels.items()}
for k,v in digests.items():check('Independent level digest '+k,v in newf['level_manifest_and_constants']['description'])
(OUT/'expected-digests.json').write_text(json.dumps(digests,indent=2)+'\n')
target=OUT/f'{SLUG}.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in sorted(files.items()):
        i=zipfile.ZipInfo(SLUG+'/'+n,(2026,9,10,0,0,0));i.create_system=3;i.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,b)
with zipfile.ZipFile(target) as z:check('Archive CRC/exact one wrapper/source hash match',z.testzip() is None and set(z.namelist())=={SLUG+'/'+n for n in files} and all(z.read(SLUG+'/'+n)==b for n,b in files.items()))
result=dict(version='2.0.4',criteria=counts,split_mapping=groups,sha256=sha(target.read_bytes()),checks=checks,source_hashes={n:sha(b) for n,b in files.items()},scope='Local structural checks, not official QC or Oracle')
(OUT/'package-audit.json').write_text(json.dumps(result,indent=2)+'\n');(OUT/'SHA256SUMS.txt').write_text(result['sha256']+'  '+target.name+'\n')
print(json.dumps(dict(checks=len(checks),criteria=counts,sha256=result['sha256'])))
