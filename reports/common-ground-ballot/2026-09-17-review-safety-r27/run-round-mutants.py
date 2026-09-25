from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import sys
import time

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'
CASES=[('partial-round',2),('roster-status-only',8),('ordered-round-receipt',13),('forgotten-round-refusal',14),('round-role-bypass',6),('upgrade-round-retry',16),('active-member-versions-only',8),('roster-excluded-from-receipt',13)]

def run(case):
    mutation,prior_passes=case
    destination=HERE/'round-mutants'/mutation
    destination.mkdir(parents=True,exist_ok=True)
    cmd=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1','--env','ROUND_MUTATION='+mutation]
    for source,target,readonly in [(TASK/'solution','/golden',True),(TASK/'tests','/tests',True),(TASK/'environment/assets/artifacts','/seed',True),(HERE,'/validation',True),(destination,'/results',False)]:
        cmd+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    cmd+=['ballot-verifier:20260916-r24-runtime-validation','python3','/validation/check-helper-container.py','rounds']
    start=time.monotonic();proc=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',timeout=650)
    (destination/'runner.log').write_text(proc.stdout+'\n'+proc.stderr,encoding='utf-8')
    data=json.loads((destination/'rounds-results.json').read_text(encoding='utf-8'))
    row={'mutation':mutation,'detected':proc.returncode!=0 and data['passed']==prior_passes and data['failed']==1,'completed_positive_checks':data['passed'],'expected_positive_checks':prior_passes,'elapsed_sec':round(time.monotonic()-start,3),'failure':data['results'][-1]}
    print(json.dumps(row),flush=True)
    return row

selected=[case for case in CASES if not sys.argv[1:] or case[0] in sys.argv[1:]]
with ThreadPoolExecutor(max_workers=2) as pool: rows=list(pool.map(run,selected))
if sys.argv[1:] and (HERE/'round-mutation-results.json').exists():
    prior=json.loads((HERE/'round-mutation-results.json').read_text(encoding='utf-8'))
    rows=[row for row in prior if row['mutation'] not in sys.argv[1:]]+rows
(HERE/'round-mutation-results.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
assert all(row['detected'] for row in rows),rows
