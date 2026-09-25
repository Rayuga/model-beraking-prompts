from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/common-ground-ballot'

def run(kind):
    destination = HERE / kind
    destination.mkdir(exist_ok=True)
    command = ['docker','run','--rm','--network','none','--env','LITELLM_LOCAL_MODEL_COST_MAP=True','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1']
    for source,target,readonly in [(TASK,'/task',True),(HERE,'/validation',True),(destination,'/results',False)]:
        command += ['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    command += ['ballot-verifier:20260917-r26-runtime-validation','python3','/validation/'+kind+'.py']
    result = subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240)
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    print(kind, result.returncode, result.stdout[-1400:], result.stderr[-1500:] if result.returncode else '',flush=True)
    return {'mode':kind,'passed':result.returncode==0}

with ThreadPoolExecutor(max_workers=2) as pool: results = list(pool.map(run,sys.argv[1:] or ['runtime-smoke']))
(HERE/'runtime-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
assert all(r['passed'] for r in results), results
