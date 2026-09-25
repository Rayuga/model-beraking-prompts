from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/common-ground-ballot'
driver = HERE/'run-session-mcp.py'
driver.write_text(driver.read_text(encoding='utf-8').replace('/tests/app-lifecycle.py', '/opt/common-ground-verifier/app-lifecycle.py'), encoding='utf-8', newline='\n')

def run(mutant):
    destination = HERE / ('session-mutant' if mutant else 'session-golden')
    destination.mkdir(exist_ok=True)
    command = ['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1','--env','EXPECT_INSECURE_SESSION='+str(int(mutant))]
    for source,target,readonly in [(TASK/'solution','/golden',True),(TASK/'environment/assets/artifacts','/seed',True),(HERE,'/validation',True),(HERE/'runtime-sources','/opt/common-ground-verifier',True),(destination,'/results',False)]:
        command += ['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    command += ['ballot-verifier:20260916-r19-runtime-validation','python3','/validation/run-session-mcp.py']
    result = subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240)
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    print(destination.name, result.returncode, result.stdout[-1000:], result.stderr[-1000:] if result.returncode else '',flush=True)
    return {'mode':destination.name,'passed':result.returncode==0}

with ThreadPoolExecutor(max_workers=2) as pool: results = list(pool.map(run,[False,True]))
(HERE/'session-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
assert all(r['passed'] for r in results), results
