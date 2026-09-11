"""Unpaid preservation checks and clean package for the standard-only update."""
from pathlib import Path
import hashlib,json,re,tomllib,zipfile
out=Path(__file__).resolve().parent;root=out.parents[2]
task=root/'projects/brickfall-breaker-arcade'
prior=out.parent/'2.0.4-rubric-repair/brickfall-breaker-arcade.zip'
checks=[]
def check(name,ok):
    checks.append({'name':name,'passed':bool(ok)})
    assert ok,name
check('historical ZIP untouched',hashlib.sha256(prior.read_bytes()).hexdigest()=='0b58147e8b868a8c069fd52337e4c5de87e42a34056e0ce45ed625b792ca1cb5')
files={p.relative_to(task).as_posix():p for p in task.rglob('*') if p.is_file()}
with zipfile.ZipFile(prior) as z:
    before={n.split('/',1)[1]:z.read(n) for n in z.namelist()}
check('same exact 30 task files',set(files)==set(before) and len(files)==30)
for name,p in sorted(files.items()):
    if p.suffix=='.toml':tomllib.loads(p.read_text(encoding='utf-8'))
    if p.suffix=='.json':json.loads(p.read_text(encoding='utf-8'))
    if name not in ['task.toml','environment/Dockerfile','tests/Dockerfile'] and not name.endswith('judge.toml'):
        expected=before[name]
        if name.endswith('prompt.md') or name=='solution/app/package.json':expected=expected.replace(b'2.0.4',b'2.0.5')
        check('preserved behavior/inputs: '+name,p.read_bytes()==expected)
    check('no credential literals: '+name,not re.search(rb'sk-(?:or-v1-|proj-)?[A-Za-z0-9_-]{20,}',p.read_bytes()))
config=tomllib.loads((task/'task.toml').read_text());old=tomllib.loads(before['task.toml'].decode())
check('identity/version',config['task']['name']=='turing/brickfall-breaker-arcade' and config['task']['version']=='2.0.5')
check('native OpenAI settings',config['verifier']['env']=={'OPENAI_API_KEY':'${OPENAI_API_KEY}','REWARDKIT_JUDGE':'codex','REWARDKIT_MODEL':'gpt-5.6-luna','REWARDKIT_REASONING_EFFORT':'max'})
check('no target metadata',not {'active_target_model','active_target_reasoning_effort'}&config['metadata'].keys())
check('public/public separate',config['environment']['network_mode']==config['verifier']['environment']['network_mode']=='public' and config['verifier']['environment_mode']=='separate')
normalized=json.loads(json.dumps(config));normalized['task']['version']=old['task']['version'];normalized['verifier']['env']=old['verifier']['env']
check('all other task settings preserved',normalized==old)
counts={};total_timeout=0
for d in ('render','constraints','functional','polish'):
    name=f'tests/{d}/judge.toml';j=tomllib.loads(files[name].read_text());b=tomllib.loads(before[name].decode())
    check(d+' model/max',j['judge']['model']=='gpt-5.6-luna' and j['judge']['reasoning_effort']=='max')
    n=json.loads(json.dumps(j));n['judge']['model']=b['judge']['model'];n['judge']['reasoning_effort']=b['judge']['reasoning_effort']
    check(d+' every criterion/weight/MCP/timeout preserved',n==b)
    check(d+' release marker','v2.0.5' in files[name].read_text().splitlines()[0])
    counts[d]=len(j['criterion']);total_timeout+=j['judge']['timeout']
check('33 criteria',counts=={'render':2,'constraints':2,'functional':22,'polish':7})
check('timeout nesting',total_timeout+1500<=11400 and config['verifier']['timeout_sec']==12600 and config['agent']['timeout_sec']+config['environment']['build_timeout_sec']+12600<=21600)
ver=files['tests/Dockerfile'].read_text();env=files['environment/Dockerfile'].read_text();runner=files['tests/test.sh'].read_text()
check('no obsolete provider wiring','openrouter' not in ver.lower() and 'OPENROUTER' not in runner and 'OPENAI' not in runner)
check('minimal native Codex config',all(x in ver for x in ['model_reasoning_effort = "max"','approval_policy = "never"','sandbox_mode = "danger-full-access"']) and 'model_provider' not in ver)
check('template launcher patch retained','--dangerously-bypass-approvals-and-sandbox' in ver)
check('baked pinned judge/browser tools retained',all(x in ver for x in ['@openai/codex@0.151.0','@playwright/mcp@0.0.79','harbor-rewardkit==0.1.7','install --with-deps chromium','test -x /usr/local/bin/chromium']))
check('task-specific dependencies retained',all(x in env and x in ver for x in ['express@5.1.0','better-sqlite3@12.4.1','xlsx@0.18.5']))
check('agent bootstrap and initialized repo',all(x in env for x in ['ca-certificates curl coreutils git procps sqlite3 python3 python3-openpyxl','test -s /etc/ssl/certs/ca-certificates.crt','git -C /app init','git -C /app commit']))
check('Docker release labels',all('"2.0.5"' in d for d in [env,ver]))
archive=out/'brickfall-breaker-arcade.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,p in sorted(files.items()):
        info=zipfile.ZipInfo('brickfall-breaker-arcade/'+name,date_time=(2026,9,11,0,0,0));info.create_system=3
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16;info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,p.read_bytes())
with zipfile.ZipFile(archive) as z:
    check('archive integrity',z.testzip() is None)
    check('single wrapper/exact inventory',set(z.namelist())=={'brickfall-breaker-arcade/'+n for n in files})
    check('every archive byte matches source',all(z.read('brickfall-breaker-arcade/'+n)==p.read_bytes() for n,p in files.items()))
result={'scope':'Local source/package checks, not platform QC','checks':checks,'criteria':counts,
        'source_sha256':{n:hashlib.sha256(p.read_bytes()).hexdigest() for n,p in files.items()},
        'archive':{'file':archive.name,'files':30,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}}
(out/'package-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'archive':result['archive']},indent=2))
