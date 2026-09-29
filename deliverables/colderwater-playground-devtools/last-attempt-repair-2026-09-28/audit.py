import hashlib,json,re,subprocess,sys,tomllib
from pathlib import Path
root=Path(__file__).resolve().parents[3];out=Path(__file__).resolve().parent
task=root/'projects/colderwater-playground-devtools';template=root/'projects/webdev-task-template'
sys.path.insert(0,str(root/'scripts'))
from check_colderwater_current import check_task
from check_public_criterion_ids import scan_task
from check_public_grader_terms import scan_task as grader_scan
from check_public_network_policy import scan_task as network_scan
report=check_task(task);checks=report['checks']
def check(name,ok,evidence=None): checks.append(dict(name=name,passed=bool(ok),evidence=evidence))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files={p.relative_to(task).as_posix():sha(p) for p in task.rglob('*') if p.is_file()}
for name,fn in [('public criterion ids',scan_task),('public grader terms',grader_scan),('public network policy',network_scan)]:
 r=fn(task);check(name,r['passed'],r)
for p in task.rglob('*'):
 if not p.is_file():continue
 if p.suffix=='.toml':tomllib.loads(p.read_text(encoding='utf-8'))
 if p.suffix=='.json':json.loads(p.read_text(encoding='utf-8'))
 if p.suffix=='.sh':
  r=subprocess.run(['C:/msys64/usr/bin/bash.exe','-n',str(p)],capture_output=True,text=True)
  check(str(p.relative_to(task))+' Bash syntax/LF',r.returncode==0 and b'\r' not in p.read_bytes(),r.stderr)
check('all JSON/TOML parse',True)
r=subprocess.run(['node','--check',str(task/'solution/app/server.js')],capture_output=True,text=True)
check('Node server syntax',r.returncode==0,r.stderr)
source_text='\n'.join((task/p).read_text(encoding='utf-8',errors='replace') for p in files)
check('no literal provider keys private keys or author home path',not re.search(r'sk-(?:proj-|or-v1-)[A-Za-z0-9_-]{15,}|AKIA[0-9A-Z]{16}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|C:\\Users\\|/Users/[a-z]',source_text))
expected_tests={'Dockerfile','test.sh','scoring.toml','app_context.md','.dockerignore','tools/score.py','tools/restart_mcp.py'}|{f'{suite}/{dim}/{file}' for suite,ds in [('gates',['render','constraints']),('scored',['functional','polish','visual'])] for dim in ds for file in ['judge.toml','prompt.md']}
check('closed tests tree',{p[6:] for p in files if p.startswith('tests/')}==expected_tests)
check('no caches runtime db or evidence in task',all(not re.search(r'(^|/)(node_modules|__pycache__|\.env|\.git)(/|$)|\.(zip|xlsx|db|pyc|log)$',p) for p in files))
check('50 task files',len(files)==50,len(files))
public=(task/'instruction.md').read_text()+'\n'+'\n'.join(p.read_text() for p in (task/'environment/instructions').glob('*.md'))
for asset in set(re.findall(r'/(?:assets|instructions)/[a-zA-Z0-9_.-]+',public)):
 check('public asset exists '+asset,(task/'environment'/asset.lstrip('/')).is_file())
check('no public placeholders/host paths',not re.search(r'TODO|FIXME|CHANGE_ME|C:\\Users|/home/[a-z]+|lorem ipsum',public,re.I))
check('six public notes',len(list((task/'environment/instructions').glob('*.md')))==6)
for file in ['environment/Dockerfile','tests/Dockerfile','tests/test.sh']:
 text=(task/file).read_text();check(file+' no API-key name',not any(s in text for s in ['OPENAI_API_KEY','OPENROUTER_API_KEY']))
seed=json.loads((task/'environment/assets/seed_data.json').read_text());check('seed empty with product scope',seed['snippets']==[] and seed['product']=='Colderwater Playground')
before=json.loads((out/'before_hashes.json').read_text());check('all23 golden files unchanged',sum(p.startswith('solution/') for p in files)==23 and all(before[p]==h for p,h in files.items() if p.startswith('solution/')))
functional=tomllib.loads((task/'tests/scored/functional/judge.toml').read_text())['criterion']
prompt=(task/'tests/scored/functional/prompt.md').read_text(encoding='utf-8')
golden=next((out/'golden').glob('run-golden-*/RESULTS.json'));g=json.loads(golden.read_text())
check('fresh57 local functional assertions',g['passed'] and len(g['fresh_fact_keys'])==57 and not g['missing_fact_keys'] and not g['failed_fact_keys'],str(golden.relative_to(root)))
check('one actual canonical restart',g['restart']['actual_calls']==1 and g['restart']['pid_before']!=g['restart']['pid_after'])
facts=g['facts'];check('JS freshness includes independent live A setter/B output',facts['S02.js_fresh_document']['product_pass'] and facts['S04.supersede_pending']['evidence']['body']=='run-B-undefined')
for file in ['results.json','ui-results.json']:
 r=json.loads((out/'focused'/file).read_text());check('focused browser '+file,r['passed'],r['checks'])
newmarkers=['promise-loop-entered','forbidden-nested-completion','nested-control-done','QC Title Source','QC Concurrent Save Draft']
delivered='\n'.join((task/p).read_text(encoding='utf-8',errors='replace') for p in files if p.startswith('solution/') or p.startswith('environment/assets/'))
check('new authored probes absent from golden and seed',all(s not in delivered for s in newmarkers))
scored=out/'scorer-cases';scored.mkdir(exist_ok=True)
cases=[('golden',1,1,1,1,1,1),('render-failed',0,1,1,1,1,0),('constraints-failed',1,0,1,1,1,0),('floor-edge',1,1,.05,1,1,0),('partial',1,1,.25,1,1,.55),('strong',1,1,.75,1,1,.85),('one-row-failed',1,1,1-.2/32.7,1,1,round(1-.6*.2/32.7,4))]
for name,r,c,f,p,v,expected in cases:
 d=scored/name;(d/'gates').mkdir(parents=True,exist_ok=True);(d/'scored').mkdir(exist_ok=True)
 (d/'gates/reward.json').write_text(json.dumps(dict(render=r,constraints=c)));(d/'scored/reward.json').write_text(json.dumps(dict(functional=f,polish=p,visual=v)))
 (d/'scored/reward-details.json').write_text(json.dumps({'fixture':'synthetic scorer input, not a model run'}))
 result=subprocess.run([sys.executable,str(task/'tests/tools/score.py'),str(d)],capture_output=True,text=True)
 actual=json.loads((d/'reward.json').read_text());check('actual canonical scorer '+name,actual['reward']==expected,actual['reward'])
report.update(passed=all(c['passed'] for c in checks),source_sha256=files,functional_outcomes=len(functional),protocols=23,estimated_ui_actions=sum(map(int,re.findall(r'About (\d+) UI actions',prompt))),actual_oracle_measured=False,actual_model_measured=False,workload_timing_measured=False)
(out/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'checks':len(checks),'failed':[c['name'] for c in checks if not c['passed']],'estimated_actions':report['estimated_ui_actions']}))
raise SystemExit(0 if report['passed'] else 1)
