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
import json, sys
from pathlib import Path
out = Path(sys.argv[sys.argv.index('--output') + 1])
out.parent.mkdir(parents=True, exist_ok=True)
data = {'render': 1, 'constraints': 1} if out.parent.name == 'gates' else {'functional': 0.4, 'polish': 1, 'visual': 1}
out.write_text(json.dumps(data))
''')
stub.chmod(0o755)
results = []
for name, handler in [('normal', ''), ('resistant', "process.on('SIGTERM', () => console.log('TERM received, keeping server alive'));" )]:
    Path('/app/server.js').write_text("const http=require('node:http');" + handler + "http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({pid:process.pid,ok:true}));}).listen(3000,'0.0.0.0');")
    logs = Path('/logs') / ('cleanup-' + name)
    log = (evidence / (name + '-cleanup.log')).open('w')
    env = dict(os.environ, VERIFIER_LOG_DIR=str(logs), REWARDKIT_JUDGE='local-stub', REWARDKIT_MODEL='no-paid-model')
    start = time.monotonic()
    harness = subprocess.Popen(['bash', '-x', '/tests/test.sh'], stdout=log, stderr=subprocess.STDOUT, env=env)
    deadline = time.monotonic() + 20
    reward = None
    while time.monotonic() < deadline:
        output = logs / 'reward.json'
        if output.exists():
            try:
                value = json.loads(output.read_text())
                if value.get('graded') == 1 and value.get('floors_passed') == 1:
                    reward = value
                    break
            except json.JSONDecodeError:
                pass
        time.sleep(.05)
    assert reward is not None, name + ': score not produced'
    app_pid = int((logs / 'app.pid').read_text())
    score_time = time.monotonic() - start
    time.sleep(3)
    status = harness.poll()
    http_pid = None
    try:
        http_pid = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=1))['pid']
    except Exception:
        pass
    trace = (evidence / (name + '-cleanup.log')).read_text()
    row = {'case': name, 'app_pid': app_pid, 'harness_pid': harness.pid, 'reward': reward,
           'reward_written_after_seconds': round(score_time, 3), 'observed_extra_seconds': 3,
           'harness_exit_after_score': status, 'http_listener_pid_after_score': http_pid,
           'app_log': (logs / 'app.log').read_text(), 'trace_tail': trace.splitlines()[-15:]}
    if status is None:
        os.killpg(app_pid, signal.SIGKILL)
    row['harness_exit_after_probe_cleanup'] = harness.wait(timeout=5)
    log.close()
    results.append(row)
report = {'test_sh_sha256': hashlib.sha256((source/'tests/test.sh').read_bytes()).hexdigest(),
          'scope': 'Actual shipped harness with synthetic dimension outputs; no paid judging or golden result.',
          'results': results,
          'confirmed': results[0]['harness_exit_after_score'] == 0 and results[1]['harness_exit_after_score'] is None
                       and results[1]['http_listener_pid_after_score'] == results[1]['app_pid']}
(evidence/'cleanup_probe_results.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
assert report['confirmed']
