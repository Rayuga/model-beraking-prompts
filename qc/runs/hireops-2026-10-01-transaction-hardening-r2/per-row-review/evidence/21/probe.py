import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

OUT = Path('/out')
SOURCE = Path('/source')
OUT.mkdir(exist_ok=True)
STUB = r'''#!/usr/local/bin/python3
import json, os, pathlib, subprocess, sys, time, urllib.request
args=sys.argv[1:]
out=pathlib.Path(args[args.index('--output')+1])
suite=pathlib.Path(args[-1]).name
case=os.environ['FIXTURE_CASE']
with open('/out/'+case+'/suite-order.jsonl','a') as f: f.write(json.dumps({'suite':suite})+'\n')
if case=='cli-failure': sys.exit(23)
if suite=='gates': data={'render':1,'constraints':1}
else:
 data={'functional':1,'polish':1,'visual':1}
 if case=='restart-retains-old-process':
  def read(): return json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/health'))
  before=read()
  p=subprocess.run([os.environ['APP_RESTART_HELPER']],text=True,capture_output=True,timeout=12)
  time.sleep(.4)
  after=read()
  pathlib.Path('/out/'+case+'/restart-observation.json').write_text(json.dumps({'before':before,'after':after,'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr},indent=2))
out.write_text(json.dumps(data))
'''
APP = r'''const http=require('node:http');
const mode=MODE;
let memory='in-memory-only';
if(mode==='ignore')process.on('SIGTERM',()=>{});
if(mode==='slow')process.on('SIGTERM',()=>{setTimeout(()=>process.exit(0),30000)});
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({pid:process.pid,uid:process.getuid(),mode,memory,keys:Object.keys(process.env).sort()}))}).listen(3000,'0.0.0.0');
'''

def stop_group(pid):
    try: os.killpg(int(pid),signal.SIGKILL)
    except (ProcessLookupError,ValueError): pass

def run_case(name, mode='normal', missing=False, symlink=False, limit=8):
    for p in [Path('/app'), Path('/tests'), Path('/tmp/submission')]:
        if p.exists(): shutil.rmtree(p)
    shutil.copytree(SOURCE/'tests','/tests')
    Path('/app').mkdir()
    Path('/assets').mkdir(exist_ok=True)
    if not missing: Path('/app/server.js').write_text(APP.replace('MODE',json.dumps(mode)))
    if symlink: Path('/app/escape').symlink_to('/tests/test.sh')
    case_dir=OUT/name
    case_dir.mkdir()
    log=case_dir/'logs'
    env=dict(os.environ,VERIFIER_LOG_DIR=str(log),REWARDKIT_JUDGE='local-stub',REWARDKIT_MODEL='local-stub',FIXTURE_CASE=name)
    started=time.monotonic()
    with (case_dir/'entrypoint.log').open('w') as capture:
        p=subprocess.Popen(['bash','/tests/test.sh'],env=env,stdout=capture,stderr=subprocess.STDOUT,start_new_session=True)
        timed_out=False
        try: p.wait(timeout=limit)
        except subprocess.TimeoutExpired: timed_out=True
        result={'case':name,'elapsed_seconds':time.monotonic()-started,'external_bound_seconds':limit,'timed_out':timed_out,'returncode_before_teardown':p.poll(),'reward':json.loads((log/'reward.json').read_text()) if (log/'reward.json').exists() else None,'reward_text':(log/'reward.txt').read_text() if (log/'reward.txt').exists() else None}
        for key in ['app.pid','app.log','app-restart.log']:
            result[key]=(log/key).read_text() if (log/key).exists() else None
        try:
            import urllib.request
            result['answering_process_before_teardown']=json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/health',timeout=1))
        except Exception as e: result['answering_process_before_teardown']=str(e)
        order=case_dir/'suite-order.jsonl'
        result['suite_order']=[json.loads(x)['suite'] for x in order.read_text().splitlines()] if order.exists() else []
        obs=case_dir/'restart-observation.json'
        if obs.exists(): result['restart_observation']=json.loads(obs.read_text())
        pids=[]
        if (log/'app.pid').exists(): pids.append((log/'app.pid').read_text().strip())
        if isinstance(result.get('answering_process_before_teardown'),dict): pids.append(result['answering_process_before_teardown']['pid'])
        for pid in pids: stop_group(pid)
        stop_group(p.pid)
        p.wait(timeout=3)
    (case_dir/'observation.json').write_text(json.dumps(result,indent=2))
    return result

Path('/usr/local/bin/rewardkit').write_text(STUB)
Path('/usr/local/bin/rewardkit').chmod(0o755)
results=[]
for name,options in [
 ('missing-entry',{'missing':True}),
 ('escaping-symlink',{'symlink':True}),
 ('cli-failure',{}),
 ('normal-gates-then-scored',{}),
 ('slow-shutdown-conforming',{'mode':'slow'}),
 ('restart-retains-old-process',{'mode':'ignore','limit':15}),
]:
    results.append(run_case(name,**options))
report={'scope':'Synthetic local orchestration only. Frozen test.sh and score.py unchanged. Local stub deliberately replaces RewardKit CLI; no configured model grade. App fixture deliberately replaces the product. Network disabled.','source_sha256':{str(p.relative_to(SOURCE)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [SOURCE/'tests/test.sh',SOURCE/'tests/tools/score.py',SOURCE/'tests/scoring.toml']},'cases':results}
(OUT/'results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
