"""Audit and package only this release; never edit prior ZIPs or official scores."""
from pathlib import Path
import hashlib,json,re,tomllib,zipfile
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2';SLUG=TASK.name
PREV=OUT.parent/'2.0.12-rubric-alignment'/f'{SLUG}.zip'
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(PREV) as z:old={n[len(SLUG)+1:]:z.read(n) for n in z.namelist() if not n.endswith('/')}
checks=[]
def check(n,b):
    assert b,n
    checks.append(n)
def sha(b):return hashlib.sha256(b).hexdigest()
check('Same 30 files, no added task files',set(files)==set(old) and len(files)==30)
changed={'task.toml','tests/reward.toml','tests/test.sh','tests/constraints/prompt.md','tests/functional/judge.toml','tests/polish/judge.toml'}
for n,b in files.items():
    check('Safe path '+n,not set(n.split('/')) & {'..','node_modules','__pycache__','.git'} and Path(n).suffix not in ('.db','.sqlite','.sqlite3','.zip','.pyc','.log','.xlsx','.docx'))
    check('No provider key '+n,not re.search(rb'sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}',b))
    check('UTF8 LF no BOM '+n,b'\r' not in b and not b.startswith(b'\xef\xbb\xbf'));s=b.decode()
    if n.endswith('.toml'):tomllib.loads(s)
    if n.endswith('.json'):json.loads(s)
    if n not in changed:check('Unchanged except release marker '+n,b.replace(b'2.0.13',b'2.0.12')==old[n])
t=tomllib.loads(files['task.toml'].decode());ot=tomllib.loads(old['task.toml'].decode())
check('Exact release identity',t['task']['name']=='turing/'+SLUG and t['task']['version']=='2.0.13')
ot['task']['version']=t['task']['version'];ot['metadata']['verification_explanation']=t['metadata']['verification_explanation']
check('Only metadata explanation/version change in task.toml',t==ot)
check('Public/public separate',t['environment']['network_mode']==t['verifier']['environment']['network_mode']=='public' and t['verifier']['environment_mode']=='separate')
check('OpenRouter-only platform credential',t['verifier']['env']=={'OPENROUTER_API_KEY':'${OPENROUTER_API_KEY}','REWARDKIT_JUDGE':'codex','REWARDKIT_MODEL':'openai/gpt-5.6-luna','REWARDKIT_REASONING_EFFORT':'high'})
counts={};weights={};budgets=[]
for dim in ('render','constraints','functional','polish'):
    name=f'tests/{dim}/judge.toml';a=tomllib.loads(files[name].decode());b=tomllib.loads(old[name].decode())
    counts[dim]=len(a['criterion']);weights[dim]=a['judge']['weight'];budgets.append(a['judge']['timeout'])
    if dim in ('functional','polish'):b['judge']['weight']=.9 if dim=='functional' else .1
    if dim=='functional':
        c=next(c for c in a['criterion'] if c['id']=='custom_editor_surface_real_input')
        prior=next(c for c in b['criterion'] if c['id']=='custom_editor_surface_real_input')
        check('Real input weight/type/identity preserved',all(c[k]==prior[k] for k in ('id','name','type','weight')))
        check('Real typing assertion retained',all(x in c['description'] for x in ('CUSTOM-SURFACE-PROOF','normal keyboard input','exact marker once','Do not dispatch synthetic events','reload without saving')))
        prior['description']=c['description']
    check('All other judge settings/criteria unchanged '+dim,a==b)
    check('Codex Luna high '+dim,a['judge']['judge']=='codex' and a['judge']['model']=='openai/gpt-5.6-luna' and a['judge']['reasoning_effort']=='high')
check('All 35 criteria retained',counts==dict(render=2,constraints=2,functional=27,polish=4))
rw=tomllib.loads(files['tests/reward.toml'].decode())['reward'][0]['weights']
check('Declared weights agree across every dimension',rw==weights and rw['functional']==.9 and rw['polish']==.1)
runner=files['tests/test.sh'].decode();prev=old['tests/test.sh'].decode()
newpart='# Constraints includes the required custom-document-surface prerequisite.\n# No presentation or partial behavior credit survives a prohibited editor.\n'
check('Runner changed only aggregate formula/comment',runner.replace(newpart,'').replace('else 0.9 * data["functional"] + 0.1 * data["polish"]','else 0.6 * data["functional"] + 0.4 * data["polish"]')==prev)
check('No runner key remapping',not re.search(r'OPENAI|OPENROUTER|API_KEY|model_provider',runner))
check('Timeout hierarchy unchanged',sum(budgets)<12000<t['verifier']['timeout_sec'] and t['environment']['build_timeout_sec']+t['agent']['timeout_sec']+t['verifier']['timeout_sec']<=21600)
gate=files['tests/constraints/prompt.md'].decode()
check('Prohibited editor hard-zeros both Constraints criteria',all(x in gate for x in ('textarea','contenteditable','Monaco','CodeMirror','assign no to BOTH Constraints','zero-reward prerequisite','must not turn\ninto a test of typing')))
check('Fair custom input controls/architecture exceptions',all(x in gate for x in ('custom DOM, canvas or SVG','keyboard/IME or clipboard plumbing','unrelated controls','do not require a particular element id')))
before=old['tests/constraints/prompt.md'].decode().replace('2.0.12','2.0.13')
insert=gate[gate.index('Required custom-document-surface gate:'):gate.index('{criteria}')]
check('Prior Constraints prompt retained',gate.replace(insert,'')==before)
functional=tomllib.loads(files['tests/functional/judge.toml'].decode())['criterion']
check('Functional criterion total preserved',sum(c['weight'] for c in functional)==20.75)
target=OUT/f'{SLUG}.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in sorted(files.items()):
        i=zipfile.ZipInfo(SLUG+'/'+n,(2026,9,10,0,0,0));i.create_system=3;i.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,b)
with zipfile.ZipFile(target) as z:
    check('ZIP CRC',z.testzip() is None)
    check('One wrapper; every member exactly matches source',set(z.namelist())=={SLUG+'/'+n for n in files} and all(z.read(SLUG+'/'+n)==b for n,b in files.items()))
result=dict(version='2.0.13',files=len(files),criteria=counts,weights=weights,sha256=sha(target.read_bytes()),previous_zip_sha256=sha(PREV.read_bytes()),checks=checks,source_hashes={n:sha(b) for n,b in files.items()},scope='Local source/package audit, not platform QC or Oracle.')
(OUT/'package-audit.json').write_text(json.dumps(result,indent=2)+'\n')
(OUT/'SHA256SUMS.txt').write_text(result['sha256']+'  '+target.name+'\n')
print(json.dumps({k:result[k] for k in ('version','files','criteria','weights','sha256')}));print('PASS',len(checks),'local assertions')
