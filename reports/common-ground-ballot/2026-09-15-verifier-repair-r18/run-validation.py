from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
TASK=ROOT/'projects/common-ground-ballot'
LEGACY=ROOT/'reports/common-ground-ballot/2026-09-15-recovery-r17'
def check(mode):
    destination=OUT/('validation-'+mode)
    destination.mkdir(exist_ok=True)
    command=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1']
    for source,target,readonly in [(TASK/'solution','/golden',True),(TASK,'/task',True),(LEGACY,'/validation',True),(destination,'/results',False)]:
        command+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    command+=['ballot-verifier:20260915-r18-local','python3','/validation/run-local.py',mode]
    result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=600)
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    print(mode,'exit',result.returncode,result.stdout[-1400:],result.stderr[-1200:] if result.returncode else '',flush=True)
    assert result.returncode==0,mode
    return {'mode':mode,'passed':True}
with ThreadPoolExecutor(max_workers=2) as pool:
    result=list(pool.map(check,sys.argv[1:]))
(OUT/('validation-'+ '-'.join(sys.argv[1:])+'.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
