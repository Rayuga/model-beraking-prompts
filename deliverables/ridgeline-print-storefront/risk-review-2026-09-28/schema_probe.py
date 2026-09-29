"""Real offline RewardKit and submitted suite runner; synthetic judge transport."""
from pathlib import Path
from decimal import Decimal
import hashlib
import importlib.metadata
import json
import os
import shutil
import subprocess
import tomllib

task = Path('/source-task')
out = Path('/evidence')
shutil.copytree(task / 'tests', '/tests', dirs_exist_ok=True)
tests = Path('/tests')
for p in tests.glob('*/*/prompt.md'):
    p.write_text(p.read_text().replace('{app_context}', (tests / 'app_context.md').read_text()))
specs = {p.parent.name: tomllib.loads(p.read_text()) for p in tests.glob('scored/*/judge.toml')}
base = Path('/tmp/ridgeline-schema')
base.mkdir()
shim = base / 'claude'
shim.write_text('''#!/usr/local/bin/python3
import json, os, sys
args=sys.argv[1:]
if args[:2]==['mcp','add']:sys.exit(0)
schema=json.loads(args[args.index('--json-schema')+1])
single='score' in schema['properties']
entries={'single':schema} if single else schema['properties']
result={}
for name,entry in entries.items():
    binary=entry['properties']['score']['type']=='string'
    value='yes' if binary else 5
    if name==os.environ['NEGATIVE_NAME']:
        if os.environ['PROBE_CASE']=='one_missing':continue
        if os.environ['PROBE_CASE']=='one_error':value='unparseable-verdict'
        elif os.environ['PROBE_CASE'].startswith('one_'):value='no'
    result[name]={'score':value,'reasoning':'Synthetic transport fixture, not app evidence.'}
payload=next(iter(result.values())) if single else result
print(json.dumps({'is_error':False,'structured_output':payload}))
''')
shim.chmod(0o755)
shell = (tests / 'test.sh').read_text()
runner = base / 'suite.sh'
runner.write_text('#!/bin/bash\nset -euo pipefail\nLOG_DIR="$1"\nrun_suite() {' + shell.split('run_suite() {', 1)[1].split('\nrm -rf "$LOG_DIR/scored"', 1)[0] + '\nrun_suite scored 11100\npython3 /tests/tools/score.py "$LOG_DIR"\n')
results=[]
for case in ['all_yes', 'one_no', 'one_small_no', 'one_error', 'one_missing']:
    row=(min if case=='one_small_no' else max)(specs['functional']['criterion'],key=lambda r:r['weight'])
    here=out/case
    (here/'gates').mkdir(parents=True,exist_ok=True)
    (here/'gates/reward.json').write_text(json.dumps({'render':1,'constraints':1}))
    env={'PATH':str(base)+':/usr/local/bin:/usr/bin:/bin','HOME':'/tmp',
         'LITELLM_LOCAL_MODEL_COST_MAP':'True','REWARDKIT_JUDGE':'claude-code',
         'REWARDKIT_MODEL':'unpaid-local-schema-fixture','APP_RESTART_HELPER':'/tmp/unused',
         'PROBE_CASE':case,'NEGATIVE_NAME':row['name']}
    proc=subprocess.run(['bash',str(runner),str(here)],env=env,text=True,capture_output=True,timeout=50)
    (here/'runner.log').write_text(proc.stdout+proc.stderr)
    result=json.loads((here/'reward.json').read_text()) if (here/'reward.json').exists() else {}
    details=json.loads((here/'scored/reward-details.json').read_text())
    expected_functional=round(1-float(row['weight'])/35,4) if case!='all_yes' else 1
    expected_reward=round(.6*expected_functional+.4,4)
    errors=[r for d in details.values() for r in d['criteria'] if r.get('error')]
    passed=proc.returncode==0 and result.get('functional')==expected_functional and result.get('reward')==expected_reward
    passed=passed and all(len(details[n]['criteria'])==len(specs[n]['criterion']) for n in specs)
    if case in ['one_error','one_missing']:passed=passed and len(errors)==1
    entry={'case':case,'passed':passed,'exit':proc.returncode,'score':result,'errors':errors,'expected_reward':expected_reward}
    results.append(entry)
    print(json.dumps(entry),flush=True)
report={'passed':all(r['passed'] for r in results),'scope':'Real RewardKit parser, aggregation, current shell run_suite and canonical scorer. Local Claude transport shim only. No provider, browser or app grading.',
        'version':importlib.metadata.version('harbor-rewardkit'),'provider_calls':0,'results':results,
        'binding':{p.relative_to(task).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (task/'tests').rglob('*') if p.is_file()}}
(out/'results.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['passed']
