"""Container-only probe: no paid judge and no writes to mounted task source."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import signal
import subprocess
import time
import urllib.request

evidence = Path('/evidence')
source = Path('/source-task')
shutil.copytree(source / 'tests', Path('/tests'), dirs_exist_ok=True)
Path('/app').mkdir(exist_ok=True)
Path('/assets').mkdir(exist_ok=True)
stub = Path('/usr/local/bin/rewardkit')
stub.write_text('''#!/usr/local/bin/python3
import json, os, signal, sys, tomllib
from pathlib import Path
out = Path(sys.argv[sys.argv.index('--output') + 1])
out.parent.mkdir(parents=True, exist_ok=True)
case = os.environ.get('HARNESS_CASE')
data = {'render': 1, 'constraints': 0 if case == 'gate_failure' else 1} if out.parent.name == 'gates' else {'functional': 1, 'polish': 1, 'visual': 1}
if case == 'already_exited' and out.parent.name == 'scored':
    os.killpg(int((out.parent.parent / 'app.pid').read_text()), signal.SIGKILL)
out.write_text(json.dumps(data))
details = {}
for dimension, value in data.items():
    spec = tomllib.loads((Path('/tests')/out.parent.name/dimension/'judge.toml').read_text())
    details[dimension] = {'score': value, 'criteria': [
        {'id': c['id'], 'name': c['name'], 'value': 1 if value else 0, 'raw': ('yes' if value else 'no') if c.get('type', 'binary') == 'binary' else (5 if value else 1),
         'weight': c.get('weight', 1), 'reasoning': 'Synthetic lifecycle fixture; not a judge verdict.'}
        for c in spec['criterion']]}
(out.parent/'reward-details.json').write_text(json.dumps(details))
''')
stub.chmod(0o755)
results = []
resistant = "process.on('SIGTERM', () => console.log('TERM received, keeping server alive'));"
for name in ['normal', 'resistant_parent', 'resistant_child', 'already_exited', 'gate_failure', 'missing_app']:
    handler = resistant if name in ['resistant_parent', 'gate_failure'] else ''
    start_server = "http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({pid:process.pid,ok:true}));}).listen(3000,'0.0.0.0');"
    if name == 'resistant_child':
        Path('/app/child.js').write_text(resistant + "setInterval(()=>{},1000);process.send({ready:true});")
        start_server = "const child=require('node:child_process').fork('/app/child.js', [], {stdio:['ignore','inherit','inherit','ipc']});child.once('message',()=>{" + start_server + "});"
    Path('/app/server.js').write_text("const http=require('node:http');" + handler + start_server)
    if name == 'missing_app':
        Path('/app/server.js').unlink()
    logs = Path('/logs') / ('cleanup-' + name)
    log = (evidence / (name + '-cleanup.log')).open('w')
    env = dict(os.environ, VERIFIER_LOG_DIR=str(logs), REWARDKIT_JUDGE='local-stub', REWARDKIT_MODEL='no-paid-model', HARNESS_CASE=name)
    start = time.monotonic()
    harness = subprocess.Popen(['bash', '-x', '/tests/test.sh'], stdout=log, stderr=subprocess.STDOUT, env=env)
    deadline = time.monotonic() + 20
    reward = None
    while time.monotonic() < deadline:
        output = logs / 'reward.json'
        if output.exists():
            try:
                value = json.loads(output.read_text())
                if (name == 'missing_app' and harness.poll() is not None) or (value.get('graded') == 1 and (name == 'gate_failure' or value.get('floors_passed') == 1)):
                    reward = value
                    break
            except json.JSONDecodeError:
                pass
        time.sleep(.05)
    assert reward is not None, name + ': score not produced'
    app_pid = int((logs / 'app.pid').read_text()) if (logs / 'app.pid').exists() else None
    score_time = time.monotonic() - start
    try:
        status = harness.wait(timeout=10)
    except subprocess.TimeoutExpired:
        status = None
    http_pid = None
    try:
        http_pid = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=1))['pid']
    except Exception:
        pass
    trace = (evidence / (name + '-cleanup.log')).read_text()
    process_rows = subprocess.check_output(['ps','-eo','pid=,pgid=,stat='], text=True).splitlines()
    live_group = [line for line in process_rows if app_pid and line.split()[1] == str(app_pid) and line.split()[2][0] not in 'ZX']
    row = {'case': name, 'app_pid': app_pid, 'harness_pid': harness.pid, 'reward': reward,
           'reward_written_after_seconds': round(score_time, 3), 'exit_after_reward_seconds': round(time.monotonic() - start - score_time, 3),
           'harness_exit_after_score': status, 'http_listener_pid_after_score': http_pid,
           'live_group_after_exit': live_group, 'app_log': (logs / 'app.log').read_text() if (logs / 'app.log').exists() else '', 'trace_tail': trace.splitlines()[-15:]}
    if status is None:
        if app_pid:
            os.killpg(app_pid, signal.SIGKILL)
    row['harness_exit_after_probe_cleanup'] = harness.wait(timeout=5)
    log.close()
    row['passed'] = status == 0 and not live_group and http_pid is None and reward['reward'] == (0 if name in ['gate_failure', 'missing_app'] else 1)
    if name == 'gate_failure':
        row['passed'] = row['passed'] and not (logs/'scored').exists()
    results.append(row)
Path('/app/server.js').write_text(resistant + "setInterval(()=>{},1000);")
source_text = (source/'tests/test.sh').read_text()
prefix = source_text.split('\nwrite_zero_reward\n', 1)[0]
script = prefix + '''
write_zero_reward
setsid node /app/server.js >/tmp/exit-status-app.log 2>&1 &
APP_PID=$!
printf '%s\\n' "$APP_PID" > "$LOG_DIR/app.pid"
trap cleanup EXIT
sleep 0.2
exit 23
'''
begin = time.monotonic()
status_result = subprocess.run(['bash','-c',script], env=dict(os.environ, VERIFIER_LOG_DIR='/logs/exit-status'), capture_output=True, text=True, timeout=12)
results.append({'case':'original_nonzero_exit_status', 'passed': status_result.returncode == 23, 'exit_code':status_result.returncode, 'elapsed_seconds':round(time.monotonic()-begin,3)})
report = {'test_sh_sha256': hashlib.sha256((source/'tests/test.sh').read_bytes()).hexdigest(),
          'scope': 'Actual repaired harness, six lifecycle/reward cases plus original exit status; synthetic dimension outputs, no paid judging.',
          'results': results,
          'passed': all(row['passed'] for row in results)}
(evidence/'cleanup_fixed_probe_results.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
assert report['passed']
