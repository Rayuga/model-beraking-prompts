import ast
import difflib
import hashlib
import json
from pathlib import Path
import re
import tomllib
import zipfile

out=Path(__file__).resolve().parent
root=out.parents[2]
task=root/'projects/common-ground-ballot'
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
write=lambda name,value:(out/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
files={p.relative_to(task).as_posix():p.read_bytes() for p in sorted(task.rglob('*')) if p.is_file()}
with zipfile.ZipFile(out.parent/'2026-09-12-judge-r3/common-ground-ballot.zip') as z:
    old={n.removeprefix('common-ground-ballot/'):z.read(n) for n in z.namelist()}
assert set(files)==set(old) and len(files)==36
changed=[n for n in files if files[n]!=old[n]]
assert changed==['solution/public/styles.css','tests/functional/judge.toml','tests/functional/prompt.md','tests/polish/judge.toml','tests/polish/prompt.md'],changed
checks={}
def check(name,value):
    checks[name]=bool(value)
    assert value,name
def leaves(x,p=''):
    return {path for k,v in x.items() for path in (leaves(v,p+k+'.') if isinstance(v,dict) else [p+k])}
ref=tomllib.loads((root/'projects/bazaarbridge-marketplace-commerce/task.toml').read_text(encoding='utf-8'))
cfg=tomllib.loads(files['task.toml'].decode())
check('reference_keys',leaves(ref)==leaves(cfg))
for key in ['schema_version','artifacts','agent','environment','verifier']:check('reference_'+key,cfg[key]==ref[key])
check('version_1_0_0',cfg['task']['version']=='1.0.0')
for name,data in files.items():
    check('allowed_root/'+name,name.split('/')[0] in {'README.md','environment','instruction.md','rubrics','solution','task.toml','tests'})
    check('no_generated/'+name,not set(Path(name).parts)&{'node_modules','.git','__pycache__','reports','jobs'} and not name.endswith(('.db','.sqlite','.pyc','.zip')))
    check('no_secrets/'+name,not re.search(rb'sk-(?:or-v1-|proj-)[A-Za-z0-9_-]{16,}',data))
    if name.endswith(('.sh','.py')):check('unix_lines/'+name,b'\r\n' not in data)
for name in ['environment/Dockerfile','tests/Dockerfile','tests/test.sh']:
    check('no_provider_key/'+name,not re.search(rb'OPEN(?:AI|ROUTER)_API_KEY',files[name],re.I))
check('max_reasoning',b'model_reasoning_effort = "max"' in files['tests/Dockerfile'])
script=files['tests/test.sh'].decode()
formula='if data["render"] <= 0.0 or data["constraints"] <= 0.0:\n    reward = 0.0\nelse:\n    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]'
check('exact_reward_formula',formula in script)
ast.parse(formula)
check('readiness_before_judge',script.index('if curl --fail')<script.index('timeout 12600 rewardkit'))
counts={};ids=set();provenance=read(out/'prompt-provenance.json')
for d in ['render','constraints','functional','polish','visual']:
    j=tomllib.loads(files[f'tests/{d}/judge.toml'].decode());previous=tomllib.loads(old[f'tests/{d}/judge.toml'].decode())
    counts[d]=len(j['criterion']);ids.update(c['id'] for c in j['criterion'])
    check('unchanged_ids_weights/'+d,[(c['id'],c['weight']) for c in j['criterion']]==[(c['id'],c['weight']) for c in previous['criterion']])
    check('central_judge/'+d,not {'judge','model','reasoning_effort'}&j['judge'].keys())
    for key,name in [('prompt_sha256','prompt.md'),('judge_sha256','judge.toml')]:check('image_hash/'+d+'/'+name,provenance['judges'][d][key]==sha(files[f'tests/{d}/{name}']))
    p=files[f'tests/{d}/prompt.md'].decode()
    check('explicit_version/'+d,len(re.findall('^Prompt version: ',p,re.M))==1)
    check('no_other_products/'+d,not re.search(r'GridForge|PatchPad|Bazaarbridge|Docketlight|Boardloom|Torquebay',p,re.I))
    check('independent_scoring/'+d,'Independent criterion scoring:' in p)
check('33_criteria',sum(counts.values())==33)
check('functional_r6',provenance['judges']['functional']['prompt_version'].endswith('-r6'))
for name in ['runtime-results.json','browser-results.json']:
    check('local/'+name,all(r['passed'] for r in read(out/name)['results']))
check('15_browser_groups',len(read(out/'browser-results.json')['results'])==15)
check('no_browser_errors',read(out/'browser-results.json')['errors']==[])
coverage=read(out.parent/'2026-09-12-judge-r3/coverage.json')
check('coverage_all_ids',{c for r in coverage['requirements'] for c in r['criteria']}==ids)
coverage['review_update']='Functional r6: exact draft fixtures and actor checks; separate input-guard evidence; published-result criteria own exact post-restart tallies while durable criterion owns sessions, records and receipts. Requirements and weights unchanged.'
write('coverage.json',coverage)
write('standard-checks.json',dict(passed=all(checks.values()),scope='Local checks, not platform QC',checks=checks))
write('before-after.json',dict(changed_files=changed,prompt_before='functional-v1.0.0-r5',prompt_after='functional-v1.0.0-r6',
    unchanged_task_config=True,unchanged_instructions=True,unchanged_server_logic=True,unchanged_criterion_ids_and_weights=True,
    recorded_scores=dict(oracle=.9595,gpt=.7393,gemini=.6536,haiku=0),new_oracle_run=False,new_platform_qc_run=False,
    local_golden_groups=15,gpt_target_guaranteed=False))
(out/'changes.diff').write_text(''.join(''.join(difflib.unified_diff(old[n].decode().splitlines(True),files[n].decode().splitlines(True),fromfile='before/'+n,tofile='after/'+n)) for n in changed),encoding='utf-8')
destination=out/'common-ground-ballot.zip'
with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in files.items():
        i=zipfile.ZipInfo('common-ground-ballot/'+n,(2026,9,12,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16
        z.writestr(i,b)
with zipfile.ZipFile(destination) as z:
    check('zip_integrity',z.testzip() is None and len(z.namelist())==36 and all(z.read('common-ground-ballot/'+n)==b for n,b in files.items()))
write('source-hashes.json',{n:sha(b) for n,b in files.items()})
write('package-audit.json',dict(passed=True,files=36,criteria=counts,zip_sha256=sha(destination.read_bytes()),oracle_run=False,platform_qc_run=False))
(out/'SHA256SUMS.txt').write_text(sha(destination.read_bytes())+'  '+destination.name+'\n',encoding='utf-8')
print('PASS package:',len(files),'files;',counts,'SHA256',sha(destination.read_bytes()))
