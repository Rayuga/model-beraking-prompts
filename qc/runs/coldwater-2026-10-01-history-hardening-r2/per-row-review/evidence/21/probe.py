"""Provider-free process control probe; execute inside an isolated disposable container."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import urllib.request

OUT = Path('/evidence')
SOURCE = Path('/frozen/task/tests')
TESTS = Path('/tests')
shutil.rmtree(TESTS)
shutil.copytree(SOURCE, TESTS)
Path('/app').mkdir(exist_ok=True)
Path('/assets').mkdir(exist_ok=True)
BIN = Path('/tmp/row21-bin')
BIN.mkdir()
stub = BIN / 'rewardkit'
stub.write_text('#!/bin/bash\nprintf "provider-free rewardkit fixture reached\\n"\nsleep "${ROW21_STUB_SLEEP:-0}"\nexit 17\n')
stub.chmod(0o755)

def live(pid):
    try:
        state = Path(f'/proc/{pid}/stat').read_text().split(') ', 1)[1].split()[0]
        return state != 'Z'
    except FileNotFoundError:
        return False

def health():
    with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=2) as r:
        return json.loads(r.read())

def wait_for(condition, seconds=8):
    stop = time.monotonic() + seconds
    while time.monotonic() < stop:
        if condition():
            return
        time.sleep(0.05)
    raise AssertionError('fixture setup did not become ready')

def run_case(name, resistant=False, restart=False):
    # This is a transport fixture, not a complete app or simulated judge score.
    server = "const http=require('http');\n"
    if resistant:
        server += "process.on('SIGTERM',()=>{});\n"
    server += "http.createServer((q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({pid:process.pid,ok:true}));}).listen(3000,'0.0.0.0');\n"
    Path('/app/server.js').write_text(server)
    log = Path('/tmp') / name
    env = dict(os.environ, PATH=f'{BIN}:' + os.environ['PATH'], REWARDKIT_JUDGE='local-fixture', REWARDKIT_MODEL='local-fixture', VERIFIER_LOG_DIR=str(log), ROW21_STUB_SLEEP='9' if restart and not resistant else '0')
    start = time.monotonic()
    with (OUT / f'{name}-test.log').open('w') as output:
        proc = subprocess.Popen(['/bin/bash', str(TESTS / 'test.sh')], stdout=output, stderr=subprocess.STDOUT, env=env)
        old_pid = None
        new_pid = None
        result = {'name': name, 'resistant_to_sigterm': resistant}
        try:
            wait_for(lambda: (log / 'gates/rewardkit.log').exists() and 'fixture reached' in (log / 'gates/rewardkit.log').read_text())
            old_pid = int((log / 'app.pid').read_text())
            result['old_pid'] = old_pid
            if resistant:
                try:
                    proc.wait(timeout=2)
                    result['cleanup_still_waiting_after_2s'] = False
                except subprocess.TimeoutExpired:
                    result['cleanup_still_waiting_after_2s'] = True
                result['old_process_still_live'] = live(old_pid)
                result['health_before_restart'] = health()
            if restart:
                request = json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'restart_app','arguments':{}}}) + '\n'
                mcp_start = time.monotonic()
                mcp = subprocess.run(['python3', '-B', str(TESTS / 'tools/restart_mcp.py'), str(log / 'app-restart.sh')], input=request, capture_output=True, text=True, timeout=14)
                result['mcp_seconds'] = round(time.monotonic()-mcp_start, 3)
                result['mcp_returncode'] = mcp.returncode
                result['mcp_response'] = json.loads(mcp.stdout)
                new_pid = int((log / 'app.pid').read_text())
                time.sleep(0.5)
                result['new_pid'] = new_pid
                result['new_process_live'] = live(new_pid)
                result['old_process_live_after_restart'] = live(old_pid)
                result['health_after_restart'] = health()
                result['restart_log'] = (log / 'app-restart.log').read_text()
            result['reward_txt'] = (log / 'reward.txt').read_text().strip()
            result['reward_json'] = json.loads((log / 'reward.json').read_text())
            if not resistant:
                result['test_exit'] = proc.wait(timeout=16)
                result['app_live_after_cleanup'] = live(int((log / 'app.pid').read_text()))
        finally:
            for pid in {old_pid, new_pid} - {None}:
                try:
                    os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            try:
                result['test_exit_after_probe_cleanup'] = proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            result['elapsed_seconds'] = round(time.monotonic()-start, 3)
            for path in log.rglob('*'):
                if path.is_file():
                    destination = OUT / name / path.relative_to(log)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(path, destination)
    return result

results = {
    'scope': 'Exact frozen test.sh and restart_mcp.py; local failure stub replaces only RewardKit executable, no providers and no app/judge score claims.',
    'source_test_sha256': hashlib.sha256((SOURCE/'test.sh').read_bytes()).hexdigest(),
    'executed_test_sha256': hashlib.sha256((TESTS/'test.sh').read_bytes()).hexdigest(),
    'cases': []
}
for args in [('ordinary_cleanup',False,False), ('ordinary_restart',False,True), ('resistant_cleanup_restart',True,True)]:
    results['cases'].append(run_case(*args))
    (OUT/'results.json').write_text(json.dumps(results, indent=2)+'\n')
print(json.dumps(results, indent=2))
