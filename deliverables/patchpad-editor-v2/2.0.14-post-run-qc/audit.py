"""Read-only exported-run audit; write fresh PatchPad evidence only."""
from pathlib import Path
import hashlib,json,re,tomllib,zipfile
from datetime import datetime
OUT=Path(__file__).resolve().parent; ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2'; RUNS=ROOT/'run-outputs/patchpad-editor-v2'
SLUG=TASK.name; checks=[]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(b):return hashlib.sha256(b).hexdigest()
def check(n,v,e=''):checks.append(dict(check=n,status='PASS' if v else 'FAIL',evidence=e))
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
cfg=tomllib.loads(files['task.toml'].decode()); dims={d:tomllib.loads(files[f'tests/{d}/judge.toml'].decode()) for d in ['render','constraints','functional','polish']}
archive=OUT.parent/'2.0.14-oracle-repair'/f'{SLUG}.zip'
with zipfile.ZipFile(archive) as z:
    check('Task ZIP CRC, exact single wrapper and 30 source files',z.testzip() is None and len(files)==30 and set(z.namelist())=={SLUG+'/'+n for n in files})
    check('Every task ZIP member equals current source',all(z.read(SLUG+'/'+n)==b for n,b in files.items()))
check('Public/public separate verifier',cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public' and cfg['verifier']['environment_mode']=='separate')
check('Canonical name/version',cfg['task']['name']=='turing/'+SLUG and cfg['task']['version']=='2.0.14')
check('Timeout nesting',sum(d['judge']['timeout'] for d in dims.values())==10550 and 10550<12000<cfg['verifier']['timeout_sec'])
check('Platform total ceiling',cfg['environment']['build_timeout_sec']+cfg['agent']['timeout_sec']+cfg['verifier']['timeout_sec']<=21600)
for n,b in files.items():
    if n.endswith('.toml'):tomllib.loads(b.decode())
    if n.endswith('.json'):json.loads(b)
    check('No credential literal '+n,not re.search(rb'sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}',b))
check('Seed copies identical',files['environment/assets/incident_seed.json']==files['tests/incident_seed.json'])
trials=[]
for p in sorted(RUNS.glob('*/*/result.json')):
    r=read(p);lock=read(p.with_name('lock.json')); rw=read(p.parent/'verifier/reward.json'); a=r['agent_info']; label=a['name'] if a['name']!='openhands-sdk' else a['model_info']['name']
    row=dict(model=label,run=p.parent.parent.name,trial=p.parent.name,task_checksum=r['task_checksum'],version=lock['task']['version'],lock_digest=lock['task']['digest'],reward=rw,exception=r.get('exception_info'),criteria={},started_at=r['started_at'],finished_at=r['finished_at'])
    for phase in ['agent_execution','verifier']:
        times=r.get(phase) or {}; row[phase+'_seconds']=(datetime.fromisoformat(times['finished_at'].replace('Z','+00:00'))-datetime.fromisoformat(times['started_at'].replace('Z','+00:00'))).total_seconds() if times.get('finished_at') and times.get('started_at') else None
    row['agent_cost_usd']=(r.get('agent_result') or {}).get('cost_usd')
    row['verifier_files']=[x.name for x in (p.parent/'verifier').iterdir() if x.is_file()]
    check(label+' reward artifacts agree',rw==r['verifier_result']['rewards'] and float((p.parent/'verifier/reward.txt').read_text())==rw['reward'])
    check(label+' no reported trial exception',r.get('exception_info') is None)
    check(label+' release version',row['version']=='2.0.14')
    detail=p.parent/'verifier/reward-details.json'
    if detail.exists():
        ds=read(detail);check(label+' all dimensions present',set(ds)==set(dims));row['criteria']=ds
        for d,v in ds.items():
            cs=v['criteria']; source={c['id']:c for c in dims[d]['criterion']}
            check(label+' criterion inventory/definitions '+d,len(cs)==len(source) and len({c['id'] for c in cs})==len(cs) and all(c['id'] in source and c['description']==source[c['id']]['description'] and c['weight']==source[c['id']]['weight'] for c in cs))
            check(label+' normalized bounded values '+d,all(isinstance(c['value'],(float,int)) and 0<=c['value']<=1 for c in cs))
            score=(float(all(c['value']==1 for c in cs)) if dims[d]['scoring']['aggregation']=='all_pass' else sum(c['value']*c['weight'] for c in cs)/sum(c['weight'] for c in cs))
            check(label+' recomputed '+d,abs(round(score,4)-rw[d])<.000051)
        expected=round(.9*rw['functional']+.1*rw['polish'],4) if rw['render']==rw['constraints']==1 else 0
        check(label+' final reward formula',expected==rw['reward'])
        check(label+' valid graded run',rw.get('graded')==1 and rw.get('no_op')==0)
        row['functional_passed']=sum(c['value']==1 for c in ds['functional']['criteria']);row['failed_functional']=[c['id'] for c in ds['functional']['criteria'] if c['value']<1]
    else:
        row['preflight_stdout']=(p.parent/'verifier/test-stdout.txt').read_text(encoding='utf-8',errors='replace')
        check(label+' ungraded output correctly labelled',rw['reward']==0 and rw['graded']==0 and rw['no_op']==1)
    app=p.parent/'artifacts/app';row['artifact_files']={x.relative_to(app).as_posix():sha(x.read_bytes()) for x in app.rglob('*') if x.is_file()}
    if label=='oracle':
        expected={n[len('solution/app/'):]:b for n,b in files.items() if n.startswith('solution/app/')}
        check('All exported Oracle source files match delivered golden',all((app/n).is_file() and sha((app/n).read_bytes())==sha(b) for n,b in expected.items()),str(len(expected))+' files')
    trials.append(row)
check('All five trials share task checksum',len(trials)==5 and len({r['task_checksum'] for r in trials})==1)
check('All five trials share version and task lock digest',len({(r['version'],r['lock_digest']) for r in trials})==1)
oracle=next(r for r in trials if r['model']=='oracle');gpt=next(r for r in trials if r['model']=='gpt-5.4-mini');haiku=next(r for r in trials if 'haiku' in r['model'])
acceptance=[dict(check='Oracle overall >=0.95',status='PASS' if oracle['reward']['reward']>=.95 else 'FAIL'),dict(check='Every Oracle Functional criterion passes',status='PASS' if oracle['functional_passed']==27 else 'FAIL'),dict(check='GPT valid grade in 0.1..0.7',status='PASS' if gpt['reward']['graded']==1 and .1<=gpt['reward']['reward']<=.7 else 'FAIL'),dict(check='Haiku completed browser grade',status='PASS' if haiku['reward']['graded']==1 else 'FAIL')]
report=dict(scope='Local post-run audit, not an official platform QC or regrade',version='2.0.14',zip_sha256=sha(archive.read_bytes()),source_hashes={n:sha(b) for n,b in files.items()},checks=checks,acceptance=acceptance,trials=trials)
(OUT/'evidence.json').write_text(json.dumps(report,indent=2,ensure_ascii=True)+'\n')
print(json.dumps(dict(checks=len(checks),failed_checks=[c for c in checks if c['status']=='FAIL'],acceptance=acceptance,runs=[dict(model=r['model'],reward=r['reward'],functional_passed=r.get('functional_passed')) for r in trials]),indent=2))
