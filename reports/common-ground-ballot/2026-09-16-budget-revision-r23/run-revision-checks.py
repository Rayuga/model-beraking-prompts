from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
import time

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'
previous=ROOT/'reports/common-ground-ballot/2026-09-16-product-gate-r22/product-gate-mcp.cjs'
prefix=previous.read_text(encoding='utf-8').split('const variant = process.env.PRODUCT_GATE_MUTANT')[0]
prefix=prefix.replace('mcp-recovery-','revision-')
(HERE/'revision-mcp.cjs').write_text(prefix+(HERE/'revision-body.cjs').read_text(encoding='utf-8'),encoding='utf-8',newline='\n')

def run(variant):
    destination=HERE/('revision-'+variant);destination.mkdir(exist_ok=True)
    command=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1','--env','REVISION_MUTANT='+variant]
    for source,target,readonly in [(TASK/'solution','/golden',True),(TASK/'environment/assets/artifacts','/seed',True),(HERE,'/validation',True),(destination,'/results',False)]:
        command+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    command+=['ballot-verifier:20260916-r23-runtime-validation','python3','/validation/run-revision-container.py']
    start=time.monotonic()
    result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240)
    row={'variant':variant,'passed':result.returncode==0,'elapsed_sec':round(time.monotonic()-start,3)}
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    print(json.dumps(row),result.stdout[-1000:],result.stderr[-2000:] if result.returncode else '',flush=True)
    return row

with ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(run,['golden','vote_increment','single_increment','approval_increment']))
(HERE/'revision-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
assert all(row['passed'] for row in results),results
