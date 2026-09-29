import os,json,shutil,subprocess,time,tomllib
from pathlib import Path
source=Path('/root/task')
out=Path('/root/output')
started=time.time()
config=tomllib.loads((source/'task.toml').read_text())
for name,value in config['verifier']['env'].items():
    if value.startswith('${') and value.endswith('}'):
        value=os.environ[value[2:-1]]
    os.environ[name]=value
os.environ.pop('OPENROUTER_API_KEY',None)
shutil.rmtree('/tests')
shutil.copytree(source/'tests','/tests')
shutil.copytree(source/'environment/assets','/assets',dirs_exist_ok=True)
subprocess.run(['bash',str(source/'solution/solve.sh')],check=True)
(out/'started.json').write_text(json.dumps({'started_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'model':config['verifier']['env']['REWARDKIT_MODEL'],'judge':config['verifier']['env']['REWARDKIT_JUDGE'],'actual_verifier':True,'synthetic_scores':False})+'\n')
try:
    result=subprocess.run(['bash','/tests/test.sh'],cwd='/tests',timeout=config['verifier']['timeout_sec'])
    status={'exit_code':result.returncode,'timed_out':False}
except subprocess.TimeoutExpired:
    status={'exit_code':None,'timed_out':True}
finally:
    shutil.copytree('/logs/verifier',out/'verifier',dirs_exist_ok=True)
status.update(elapsed_seconds=round(time.time()-started,2),finished_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
(out/'completion.json').write_text(json.dumps(status,indent=2)+'\n')
print(json.dumps(status),flush=True)
