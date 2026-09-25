from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import sys
import time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];TASK=ROOT/'projects/common-ground-ballot'
legacy=ROOT/'reports/common-ground-ballot/2026-09-15-verifier-repair-r18/helper-integration.cjs'
text=legacy.read_text(encoding='utf-8').replace('/tests/browser-evidence.js','/opt/common-ground-verifier/browser-evidence.js')
text=text.replace("{stdio: ['pipe', 'pipe', 'pipe']}","{cwd: '/opt/common-ground-verifier', stdio: ['pipe', 'pipe', 'pipe']}",1)
(HERE/'helper-integration.cjs').write_text(text,encoding='utf-8',newline='\n')
def run(mode):
 destination=HERE/mode;destination.mkdir(exist_ok=True)
 command=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1']
 for source,target,readonly in [(TASK/'solution','/golden',True),(TASK/'environment/assets/artifacts','/seed',True),(HERE,'/validation',True),(destination,'/results',False)]:
  command+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
 command+=['ballot-verifier:20260916-r24-runtime-validation','python3','/validation/check-helper-container.py',mode]
 start=time.monotonic();result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',timeout=600)
 (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
 row={'mode':mode,'passed':result.returncode==0,'elapsed_sec':round(time.monotonic()-start,3)}
 print(json.dumps(row),result.stdout[-2400:],result.stderr[-2000:] if result.returncode else '',flush=True)
 return row
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,sys.argv[1:] or ['resilience','helper-integration']))
(HERE/'helper-check-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
assert all(row['passed'] for row in results),results
