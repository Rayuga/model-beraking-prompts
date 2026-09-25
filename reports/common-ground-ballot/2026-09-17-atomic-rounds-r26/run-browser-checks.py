from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import sys
import time

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'

def run(mode):
    destination=HERE/mode
    destination.mkdir(exist_ok=True)
    command=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1']
    subject=TASK/'solution'
    if mode=='gpt-replay':
        subject=ROOT/'run-outputs/common-ground-ballot/run-067f97d6-7a35-4cd1-a9ee-0627707ac8a1/common-ground-ballot__pArUoq4/artifacts/app'
    for source,target,readonly in [(subject,'/golden',True),(TASK/'tests','/tests',True),(TASK/'environment/assets/artifacts','/seed',True),(HERE,'/validation',True),(destination,'/results',False)]:
        command+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    command+=['ballot-verifier:20260916-r24-runtime-validation','python3','/validation/check-helper-container.py',mode]
    start=time.monotonic()
    result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',timeout=650)
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    row={'mode':mode,'passed':result.returncode==0,'elapsed_sec':round(time.monotonic()-start,3)}
    print(json.dumps(row),result.stdout[-5000:],result.stderr[-2500:] if result.returncode else '',flush=True)
    (destination/'run-result.json').write_text(json.dumps(row,indent=2)+'\n',encoding='utf-8')
    return row

if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(run,sys.argv[1:] or ['review','helper-integration']))
    assert all(row['passed'] for row in results),results
