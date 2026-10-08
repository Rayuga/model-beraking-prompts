"""No-provider runtime witnesses against the exact inherited test.sh and MCP."""
import hashlib, json, os, shutil, signal, subprocess, time, urllib.request
from pathlib import Path

out = Path('/evidence/shared-harness'); out.mkdir(exist_ok=True)
script = Path('/tests/test.sh').read_text()
results = {'scope': 'Local shared-template fixtures; no model grades and no canonical edits',
           'test_sha256': hashlib.sha256(Path('/tests/test.sh').read_bytes()).hexdigest(),
           'restart_mcp_sha256': hashlib.sha256(Path('/tests/tools/restart_mcp.py').read_bytes()).hexdigest()}
app = Path('/app'); app.mkdir(exist_ok=True)
entry = app/'server.js'
entry.write_text("const http=require('http');process.on('SIGTERM',()=>{});http.createServer((req,res)=>{res.end(JSON.stringify({pid:process.pid}));}).listen(3000,'0.0.0.0');\n")
def read_pid():
    try:
        return json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=1))['pid']
    except Exception:
        return None
def wait_ready():
    for _ in range(80):
        p=read_pid()
        if p: return p
        time.sleep(.1)
    raise RuntimeError('Fixture failed to start')
def kill_group(pid):
    try: os.killpg(pid,signal.SIGKILL)
    except ProcessLookupError: pass

case=out/'restart'; case.mkdir(exist_ok=True)
oldlog=(case/'old.log').open('w')
old=subprocess.Popen(['node',str(entry)],start_new_session=True,stdout=oldlog,stderr=subprocess.STDOUT)
old_pid=wait_ready()
(case/'app.pid').write_text(str(old.pid))
helper=script.split('<<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
for token,value in [('__LOG_DIR__',str(case)),('__APP_COPY__','/tmp'),('__APP_DB__','/app/app.db'),('__APP_ENTRY__',str(entry))]:
    helper=helper.replace(token,value)
helper_path=case/'app-restart.sh'; helper_path.write_text(helper+'\n'); helper_path.chmod(0o755)
request=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'restart_app','arguments':{}}})+'\n'
started=time.monotonic()
probe=subprocess.run(['python3','/tests/tools/restart_mcp.py',str(helper_path)],input=request,text=True,capture_output=True,timeout=60)
time.sleep(.5)
reply=json.loads(probe.stdout.strip())
results['restart']={'duration_seconds':time.monotonic()-started,'mcp_reply':reply,'old_pid':old_pid,'recorded_new_pid':int((case/'app.pid').read_text()),'answering_pid_after':read_pid(), 'replacement_log':(case/'app-restart.log').read_text()}
results['restart']['false_success_reproduced']=not reply['result']['isError'] and results['restart']['answering_pid_after']==old_pid
kill_group(old.pid); old.wait(timeout=5); oldlog.close()
kill_group(results['restart']['recorded_new_pid'])

# Exercise the full entrypoint's EXIT cleanup, substituting only an external
# failing CLI fixture so no provider is contacted. test.sh itself is unchanged.
bin_dir=Path('/tmp/no-provider-bin');bin_dir.mkdir(exist_ok=True)
stub=bin_dir/'rewardkit';stub.write_text('#!/bin/sh\nprintf "LOCAL CLI FAILURE FIXTURE, NO GRADING\\n"\nexit 7\n');stub.chmod(0o755)
case=out/'cleanup';case.mkdir(exist_ok=True)
env={**os.environ,'PATH':str(bin_dir)+':'+os.environ['PATH'],'REWARDKIT_JUDGE':'claude-code','REWARDKIT_MODEL':'z-ai/glm-5.3-flashx','VERIFIER_LOG_DIR':str(case)}
log=(case/'entrypoint.log').open('w');started=time.monotonic()
proc=subprocess.Popen(['bash','/tests/test.sh'],env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
timed_out=False
try: proc.wait(timeout=12)
except subprocess.TimeoutExpired: timed_out=True
fixture_pid=int((case/'app.pid').read_text()) if (case/'app.pid').exists() else None
results['cleanup']={'bounded_observation_seconds':time.monotonic()-started,'entrypoint_still_running':proc.poll() is None,'timed_out':timed_out,'fixture_pid':fixture_pid,'answering_pid':read_pid(),'reward_before_forced_teardown':json.loads((case/'reward.json').read_text()),'cli_fixture_log':(case/'gates/rewardkit.log').read_text()}
if fixture_pid: kill_group(fixture_pid)
if proc.poll() is None:
    try:proc.wait(timeout=3)
    except subprocess.TimeoutExpired:kill_group(proc.pid);proc.wait(timeout=3)
log.close()
results['cleanup']['unbounded_wait_reproduced']=timed_out and results['cleanup']['answering_pid']==fixture_pid
assert results['restart']['false_success_reproduced']
assert results['cleanup']['unbounded_wait_reproduced']
(out/'results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
