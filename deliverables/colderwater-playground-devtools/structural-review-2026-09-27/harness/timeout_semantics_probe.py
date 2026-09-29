"""Unpaid installed-RewardKit behavior probe. Only /tmp fixtures are modified."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import os
import signal
import subprocess
import time

out=Path('/evidence')
base=Path('/tmp/cw-rk-timeout-probe');base.mkdir()
shim=base/'bin';shim.mkdir()
(shim/'claude').write_text('''#!/usr/local/bin/python3
import json,os,sys,time
args=sys.argv[1:]
schema=json.loads(args[args.index('--json-schema')+1])
single='score' in schema['properties']
prompt=args[args.index('-p')+1]
first='first_observation' in prompt and 'second_observation' not in prompt
payload={'score':'yes','reasoning':'Local transport fixture observed the first criterion.'} if single else {name:{'score':'yes','reasoning':'Local transport fixture emitted this before hanging.'} for name in schema['properties']}
with open(os.environ['CW_TRACE'],'a') as f:f.write(json.dumps({'event':'cli_started','single':single,'first':first})+'\\n')
if os.environ['CW_CASE']=='batched_stdout_then_timeout' or (single and not first):
    print(json.dumps({'is_error':False,'structured_output':payload}),flush=True)
    time.sleep(20)
else:
    print(json.dumps({'is_error':False,'structured_output':payload}),flush=True)
    with open(os.environ['CW_TRACE'],'a') as f:f.write(json.dumps({'event':'first_criterion_successful_cli_exit'})+'\\n')
''')
(shim/'claude').chmod(0o755)
cases=[('batched_stdout_then_timeout','batched',1,None),('individual_timeout_retains_first','individual',1,None),('individual_outer_kill_loses_disk_checkpoint','individual',10,1.5)]
if os.environ.get('CW_PROBE_CASE'):
    cases=[x for x in cases if x[0]==os.environ['CW_PROBE_CASE']]
results=[]
for name,mode,timeout,outer in cases:
    folder=base/name/'functional';folder.mkdir(parents=True)
    (folder/'judge.toml').write_text(f'''[judge]
judge="claude-code"
mode="{mode}"
timeout={timeout}
isolated=false
[scoring]
aggregation="weighted_mean"
[[criterion]]
id="first"
name="first_observation"
type="binary"
weight=1.0
description="first_observation"
[[criterion]]
id="second"
name="second_observation"
type="binary"
weight=3.0
description="second_observation"
''')
    result_dir=out/name;result_dir.mkdir(exist_ok=True)
    env={'PATH':str(shim)+':/usr/local/bin:/usr/bin:/bin','HOME':'/tmp','LITELLM_LOCAL_MODEL_COST_MAP':'True','REWARDKIT_JUDGE':'claude-code','REWARDKIT_MODEL':'local-no-provider','CW_CASE':name,'CW_TRACE':str(result_dir/'transport_trace.jsonl')}
    command=['rewardkit','--max-concurrent-agent','1','--output',str(result_dir/'reward.json'),str(folder.parent)]
    proc=subprocess.Popen(command,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
    started=time.monotonic();outer_killed=False
    if outer:
        # The kill must follow an observed first verdict, not kill slow Python
        # imports before the process reaches the intended checkpoint boundary.
        tracefile=result_dir/'transport_trace.jsonl'
        deadline=time.monotonic()+15
        while time.monotonic()<deadline:
            if tracefile.exists() and 'first_criterion_successful_cli_exit' in tracefile.read_text():break
            if proc.poll() is not None:break
            time.sleep(.05)
        outer=.4
    try:stdout,stderr=proc.communicate(timeout=outer or 15)
    except subprocess.TimeoutExpired:
        outer_killed=True;os.killpg(proc.pid,signal.SIGKILL);stdout,stderr=proc.communicate(timeout=5)
    (result_dir/'cli.log').write_text(stdout+stderr)
    scores=json.loads((result_dir/'reward.json').read_text()) if (result_dir/'reward.json').exists() else None
    details=json.loads((result_dir/'reward-details.json').read_text()) if (result_dir/'reward-details.json').exists() else None
    trace=[json.loads(x) for x in (result_dir/'transport_trace.jsonl').read_text().splitlines()] if (result_dir/'transport_trace.jsonl').exists() else []
    row={'case':name,'mode':mode,'judge_timeout_sec':timeout,'outer_killed':outer_killed,'exit':proc.returncode,'elapsed_sec':round(time.monotonic()-started,3),'scores':scores,'details':details,'trace':trace}
    if name=='batched_stdout_then_timeout':
        row['passed']=proc.returncode==0 and scores=={'functional':0.0} and all(x.get('error') and x['raw'] is None for x in details['functional']['criteria']) and details['functional']['judge_output']==''
    elif name=='individual_timeout_retains_first':
        items=details['functional']['criteria'] if details else []
        row['passed']=proc.returncode==0 and scores=={'functional':0.25} and items[0]['value']==1 and 'error' not in items[0] and items[1].get('error') is not None
    else:
        row['passed']=outer_killed and scores is None and details is None and any(x['event']=='first_criterion_successful_cli_exit' for x in trace)
    results.append(row);print(name,row['passed'],flush=True)
report={'passed':all(x['passed'] for x in results),'version':importlib.metadata.version('harbor-rewardkit'),'network':'Docker --network none','paid_provider':False,'task_edited':False,'scope':'Actual installed CLI with local transport fixture and disposable tiny rubric; timing shortened only in fixture, never in task.','results':results}
(out/('timeout_semantics_outer_results.json' if os.environ.get('CW_PROBE_CASE') else 'timeout_semantics_results.json')).write_text(json.dumps(report,indent=2)+'\n')
assert report['passed'],report
