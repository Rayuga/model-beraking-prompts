"""Task-specific unpaid structural/preservation checks and one clean upload ZIP."""
from pathlib import Path
import hashlib, json, re, tomllib, zipfile
out=Path(__file__).resolve().parent
root=next(p for p in out.parents if (p/'projects').is_dir())
task=root/'projects/gridforge-spreadsheet-v2'
baseline=json.loads((out.parent/'gridforge-v2-2.0.11-validation/baseline.json').read_text(encoding='utf-8'))
checks=[]
def check(name, condition):
    checks.append({'name':name,'passed':bool(condition)})
    assert condition,name
config=tomllib.loads((task/'task.toml').read_text())
check('unchanged canonical task name', config['task']['name']=='turing/gridforge-spreadsheet-v2')
check('release version',config['task']['version']=='2.0.12')
check('obsolete target metadata absent', not {'active_target_model','active_target_reasoning_effort'} & config['metadata'].keys())
check('agent public',config['environment']['network_mode']=='public')
check('verifier public and separate',config['verifier']['environment']['network_mode']=='public' and config['verifier']['environment_mode']=='separate')
check('exact lead credential/model settings',config['verifier']['env']=={
    'OPENAI_API_KEY':'${OPENAI_API_KEY}','REWARDKIT_JUDGE':'codex',
    'REWARDKIT_MODEL':'gpt-5.6-luna','REWARDKIT_REASONING_EFFORT':'max'})
check('total task time within six-hour cap',sum((config['agent']['timeout_sec'],config['environment']['build_timeout_sec'],config['verifier']['timeout_sec']))<=21600)
check('verifier within five-hour cap',config['verifier']['timeout_sec']<=18000)
reward=tomllib.loads((task/'tests/reward.toml').read_text())['reward'][0]['weights']
judges={p.parent.name:tomllib.loads(p.read_text(encoding='utf-8')) for p in (task/'tests').glob('*/judge.toml')}
timeouts=sum(d['judge']['timeout'] for d in judges.values())
check('sequential judge budget plus overhead fits wrapper',timeouts+1200<=12000)
check('outer verifier leaves startup/shutdown slack',12600-12000>=600)
changed=[]
for dimension,d in judges.items():
    old=baseline['judges'][dimension]
    check(f'{dimension}: same criterion ids and weights',[(c['id'],c['type'],c['weight'],c.get('points')) for c in d['criterion']]==[(c['id'],c['type'],c['weight'],c.get('points')) for c in old['criterion']])
    check(f'{dimension}: same dimension weight and aggregation',d['judge']['weight']==old['judge']['weight']==reward[dimension] and d['scoring']==old['scoring'])
    check(f'{dimension}: native model/max/codex',d['judge']['judge']=='codex' and d['judge']['model']=='gpt-5.6-luna' and d['judge']['reasoning_effort']=='max')
    prompt=(task/'tests'/dimension/d['judge']['prompt_template']).read_text(encoding='utf-8')
    check(f'{dimension}: criteria placeholder / live gate / injection defense','{criteria}' in prompt and 'http://localhost:3000' in prompt and 'untrusted' in prompt and 'same-origin data' in prompt)
    check(f'{dimension}: consistent version markers',all('v2.0.12' in (task/'tests'/dimension/f).read_text(encoding='utf-8').splitlines()[0] for f in ('judge.toml','prompt.md')))
    check(f'{dimension}: unchanged pinned browser command',d['judge']['mcp_servers']==old['judge']['mcp_servers'])
    for a,b in zip(d['criterion'],old['criterion']):
        if a['description']!=b['description']:changed.append(a['id'])
check('only three demonstrated fairness descriptions changed',set(changed)=={'find_replace_navigation_and_atomic_replace_all','stale_save_and_workbook_identity_rejections','api_session_user_mismatch_rejected'})
check('44 criteria retained',sum(len(d['criterion']) for d in judges.values())==44)
script=(task/'tests/test.sh').read_text()
check('no runner provider/key remapping',not re.search(r'OPENAI|OPENROUTER|codex login|api_key|base_url',script,re.I))
check('readiness before paid runner',script.index('curl --fail')<script.index('rewardkit --max'))
check('test.sh unchanged',hashlib.sha256((task/'tests/test.sh').read_bytes()).hexdigest()==baseline['hashes']['tests/test.sh'])
check('restart helper and controller unchanged',all(hashlib.sha256((task/p).read_bytes()).hexdigest()==baseline['hashes'][p] for p in ('tests/app-control.sh','tests/restart-app.sh')))
check('server/formulas/seed contract not rewritten',all(hashlib.sha256((task/p).read_bytes()).hexdigest()==baseline['hashes'][p] for p in ('solution/app/src/index.js','solution/app/src/db.js','environment/assets/workbook_seed.json','tests/workbook_seed.json')))
check('seed copies identical',(task/'environment/assets/workbook_seed.json').read_bytes()==(task/'tests/workbook_seed.json').read_bytes())
env=(task/'environment/Dockerfile').read_text();ver=(task/'tests/Dockerfile').read_text()
check('bootstrap TLS and tools preserved',all(v in env for v in ('ca-certificates','update-ca-certificates','test -s /etc/ssl/certs/ca-certificates.crt','curl coreutils','git procps sqlite3')))
check('shared template agent init',all(v in env for v in ('express@5.1.0','better-sqlite3@12.4.1','git -C /app init','commit -m')))
check('task-specific preinstalled deps in both images',all('/opt/gridforge-deps' in t and 'express@5.2.1' in t for t in (env,ver)))
check('judge tools baked at pinned versions',all(v in ver for v in ('@openai/codex@0.151.0','@playwright/mcp@0.0.79','harbor-rewardkit==0.1.7','openai==2.30.0','install --with-deps chromium')))
check('noninteractive RewardKit launcher patch', '--dangerously-bypass-approvals-and-sandbox' in ver and 'assert old in s and new not in s' in ver)
check('no custom provider config',not re.search('openrouter|model_provider|base_url|env_key',ver,re.I))
for f in ('solution/app/package.json','solution/app/package-lock.json'):
    p=json.loads((task/f).read_text());check(f+' release',p['version']=='2.0.12')
    if 'packages' in p:check('lock root version',p['packages']['']['version']=='2.0.12')
check('Docker labels updated',all('io.turing.task.version="2.0.12"' in d for d in (env,ver)))
check('Find initial convention explicit', 'either is fine' in (task/'environment/assets/instructions/spreadsheet.md').read_text())
files={p.relative_to(task).as_posix():p for p in task.rglob('*') if p.is_file()}
check('same 32 task files only',set(files)==set(baseline['hashes']) and len(files)==32)
check('no caches/modules/db/reports in archive',not any(re.search(r'node_modules|__pycache__|\.db(?:-|$)|\.sqlite|\.zip$|\.log$|\.env$',p) for p in files))
check('no embedded credential literals',not any(re.search(rb'sk-(?:or-v1-|proj-)?[A-Za-z0-9_-]{20,}',p.read_bytes()) for p in files.values()))
archive=out/'gridforge-spreadsheet-v2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for relative,p in sorted(files.items()):
        info=zipfile.ZipInfo('gridforge-spreadsheet-v2/'+relative,date_time=(2026,9,11,0,0,0))
        info.create_system=3;info.external_attr=(0o100755 if relative.endswith('.sh') else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
with zipfile.ZipFile(archive) as z:
    check('ZIP integrity',z.testzip() is None)
    check('exact one wrapper',set(z.namelist())=={'gridforge-spreadsheet-v2/'+p for p in files})
    check('every ZIP byte equals current source',all(z.read('gridforge-spreadsheet-v2/'+p)==f.read_bytes() for p,f in files.items()))
hashes={p:hashlib.sha256(f.read_bytes()).hexdigest() for p,f in files.items()}
result={'scope':'Local deterministic source/package checks, not platform QC','checks':checks,'version':'2.0.12',
        'criterion_counts':{d:len(j['criterion']) for d,j in judges.items()},'changed_criterion_descriptions':changed,
        'sequential_judge_timeout_sum':timeouts,'source_sha256':hashes,'archive':{'file':archive.name,'files':len(files),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}}
(out/'structural-checks.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'checks_passed':len(checks),'archive':result['archive']},indent=2))
