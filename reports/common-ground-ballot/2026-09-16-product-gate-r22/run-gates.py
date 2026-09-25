from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import time
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT/'projects/common-ground-ballot'
script = HERE/'product-gate-mcp.cjs'
text = script.read_text(encoding='utf-8')
script.write_text(text[:text.index("const variant = process.env.PRODUCT_GATE_MUTANT")] + (HERE/'product-gate-body.cjs').read_text(encoding='utf-8'),encoding='utf-8',newline='\n')

def run(variant):
    destination = HERE/('gate-'+variant)
    destination.mkdir(exist_ok=True)
    command = ['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1','--env','PRODUCT_GATE_MUTANT='+variant]
    for source,target,readonly in [(TASK/'solution','/golden',True),(TASK/'environment/assets/artifacts','/seed',True),(HERE,'/validation',True),(destination,'/results',False)]:
        command += ['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    command += ['ballot-verifier:20260916-r22-runtime-validation','python3','/validation/run-product-gate.py']
    start = time.monotonic()
    result = subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=420)
    record = {'variant':variant,'passed':result.returncode==0,'elapsed_sec':round(time.monotonic()-start,3)}
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    print(json.dumps(record),result.stdout[-650:],result.stderr[-900:] if result.returncode else '',flush=True)
    return record

with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(run,sys.argv[1:] or ['golden','readonly','create_only','publish_stub']))
if sys.argv[1:] and (HERE/'gate-run-results.json').exists():
    prior = json.loads((HERE/'gate-run-results.json').read_text(encoding='utf-8'))
    updated = {row['variant']: row for row in prior}
    updated.update({row['variant']: row for row in results})
    results = [updated[variant] for variant in ['golden','readonly','create_only','publish_stub']]
(HERE/'gate-run-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
assert all(row['passed'] for row in results), results
