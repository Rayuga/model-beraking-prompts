from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json,time,hashlib,tomllib
RUN=Path(__file__).resolve().parent;ROOT=RUN.parents[2];M=json.loads((RUN/'manifest.json').read_text());T=ROOT/M['cache']/'task';OUT=RUN/'local/uncached-build';OUT.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
conf=tomllib.loads((T/'task.toml').read_text());limit=conf['environment']['build_timeout_sec']
def build(kind,folder):
    tag=f'hireops-{kind}:20261001-hard-r3-uncached'
    cmd=['docker','build','--no-cache','--progress=plain','-t',tag,str(T/folder)]
    log=OUT/(kind+'.log');start=time.monotonic();timeout=False
    with log.open('w',encoding='utf-8') as f:
        try:r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=limit);code=r.returncode
        except subprocess.TimeoutExpired:code=None;timeout=True
    duration=time.monotonic()-start
    record={'image':tag,'command':cmd,'timeout_sec':limit,'timed_out':timeout,'exit_code':code,'duration_seconds':duration,'log':log.relative_to(ROOT).as_posix(),'log_sha256':sha(log)}
    if code==0:record['image_id']=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]['Id']
    (OUT/(kind+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(kind,code,round(duration,3),flush=True);return record
with ThreadPoolExecutor(max_workers=2) as pool:records=list(pool.map(lambda args:build(*args),[('agent','environment'),('verifier','tests')]))
assert all(sha(T/p)==h for p,h in M['inputs']['task'].items())
result={'input_sha256':M['input_sha256'],'scope':'Uncached task layers on existing local Docker base images; registry/base-download cold time is excluded. Builds ran concurrently and used public package networks. No application or provider grading.','source_sha256':M['inputs']['task'],'commands':records,'passed':all(r['exit_code']==0 for r in records)}
(RUN/'verification-uncached-build.json').write_text(json.dumps(result,indent=2)+'\n')
index=json.loads((RUN/'raw-evidence-index.json').read_text());entries={e['path']:e for e in index['entries']}
for p in [Path(__file__),RUN/'verification-uncached-build.json',*OUT.glob('*')]:
    entries[p.relative_to(ROOT).as_posix()]={'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'scope':'Local uncached task-layer build timing only; existing base images and network availability affect timing.'}
index['entries']=list(entries.values());(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
raise SystemExit(0 if result['passed'] else 1)
