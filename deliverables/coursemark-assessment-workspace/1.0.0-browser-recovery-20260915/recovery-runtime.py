import asyncio
import http.server
import json
import os
from pathlib import Path
import queue
import signal
import subprocess
import threading
import time

RUNTIME = Path('/evidence/runtime')
OUT = RUNTIME / str(time.time_ns())
OUT.mkdir(parents=True, exist_ok=True)
LOG = OUT / 'verifier-logs'
LOG.mkdir(exist_ok=True)
env = {**os.environ, 'VERIFIER_LOG_DIR': str(LOG), 'COURSEMARK_PLAYWRIGHT_BIN': '/usr/local/bin/playwright-mcp'}
results = []

def passed(name, **evidence):
    results.append(dict(name=name, passed=True, **evidence))
    print('PASS ' + name, flush=True)

def wait_for(fn, limit=10):
    start = time.monotonic()
    while time.monotonic() - start < limit:
        value = fn()
        if value:
            return value
        time.sleep(.05)
    raise AssertionError('Timed out waiting for fixture condition')

def helper(*args, payload=None, expect=0):
    p = subprocess.run(['python3', '/tests/evidence.py', *args], input=None if payload is None else json.dumps(payload), capture_output=True, text=True, env=env, timeout=10)
    assert p.returncode == expect, (p.returncode, p.stdout, p.stderr)
    return json.loads(p.stdout) if p.stdout.strip() else None

helper('initialize')
batch = [{'criterion': 'sign_in_labels_and_keyboard_focus', 'step': 'controls', 'data': {'observations': ['Email', 'Password', 'Sign in'], 'literal': 'quote " and line\n'}}, {'criterion': 'sign_in_help_and_error_recovery', 'step': 'error', 'data': {'status': 401, 'body': {'error': 'Invalid credentials'}, 'visible': 'Sign-in refused'}}]
r = helper('record-batch', 'polish', payload=batch)
assert r['recorded_count'] == 2
assert helper('read', 'polish', batch[0]['criterion'])[0]['data'] == batch[0]['data']
passed('batch_checkpoints_preserve_exact_multiline_evidence')
size = (LOG / 'evidence/checkpoints.jsonl').stat().st_size
helper('record-batch', 'polish', payload=[batch[0], {**batch[1], 'criterion': 'not_a_criterion'}], expect=1)
assert (LOG / 'evidence/checkpoints.jsonl').stat().st_size == size
helper('record-batch', 'polish', payload=[{**batch[0], 'dimension': 'functional'}], expect=1)
assert (LOG / 'evidence/checkpoints.jsonl').stat().st_size == size
passed('malformed_batch_is_rejected_before_any_append_or_metadata_override')
helper('record', 'functional', '_handoff', 'ready', payload={'attempt_id': 'review-A', 'status': 'graded'})
helper('record', 'functional', '_handoff', 'final', payload={'attempt_id': 'review-A', 'status': 'graded', 'after_restart': True})
assert helper('read', 'functional', '_handoff', '--latest')['data']['after_restart']
passed('single_checkpoint_and_latest_handoff_remain_compatible')

fixture = OUT / 'fake-codex'
fixture.write_text('''#!/usr/bin/env python3
import os,sys,time,json,subprocess
from pathlib import Path
mode=os.environ.get("FIXTURE_MODE","success")
if sys.argv[1]!="exec":
 print("fixture-version")
 raise SystemExit(0)
if mode in ("success","failure"):
 print("schema-result")
 print("trace-evidence",file=sys.stderr)
 raise SystemExit(7 if mode=="failure" else 0)
child=subprocess.Popen([sys.executable,"-c","import time; time.sleep(60)"])
Path(os.environ["FIXTURE_PIDFILE"]).write_text(json.dumps({"launcher":os.getpid(),"native_child":child.pid}))
print("native-child-started",flush=True)
time.sleep(60)
''')
fixture.chmod(0o755)
trace_env = {**env, 'COURSEMARK_CODEX_BIN': str(fixture)}
command = ['python3', '/tests/evidence.py', 'trace-codex', 'exec', 'Prompt version: coursemark-assessment-workspace-polish-v1.0.0-r6']
for mode, code in [('success', 0), ('failure', 7)]:
    p = subprocess.run(command, env={**trace_env, 'FIXTURE_MODE': mode}, capture_output=True, text=True, timeout=8)
    assert p.returncode == code and p.stdout == 'schema-result\n' and p.stderr == 'trace-evidence\n', (p.returncode, p.stdout, p.stderr)
passed('supervisor_preserves_original_stdout_stderr_and_success_failure_status')
p = subprocess.run(command[:3] + ['--version'], env=trace_env, capture_output=True, text=True, timeout=5)
assert p.returncode == 0 and p.stdout == 'fixture-version\n'
passed('non_exec_cli_calls_remain_transparent')

def dead(pid):
    p = Path(f'/proc/{pid}/stat')
    return not p.exists() or p.read_text().split(') ', 1)[1].startswith('Z ')

for sig in [signal.SIGTERM, signal.SIGKILL]:
    file = OUT / f'pids-{sig}.json'
    p = subprocess.Popen(command, env={**trace_env, 'FIXTURE_MODE': 'spawn', 'FIXTURE_PIDFILE': str(file)}, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    wait_for(file.exists)
    ids = json.loads(file.read_text())
    before = time.monotonic()
    os.kill(p.pid, sig)
    stdout, stderr = p.communicate(timeout=5)
    wait_for(lambda: dead(ids['launcher']) and dead(ids['native_child']), 3)
    assert time.monotonic() - before < 3
    passed('judge_signal_cleans_native_child_and_inherited_pipes_' + str(sig), elapsed_seconds=round(time.monotonic() - before, 3))

async def rewardkit_timeout():
    file = OUT / 'pids-timeout.json'
    p = await asyncio.create_subprocess_exec(*command, env={**trace_env, 'FIXTURE_MODE': 'spawn', 'FIXTURE_PIDFILE': str(file)}, stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    assert await asyncio.wait_for(p.stdout.readline(), timeout=5) == b'native-child-started\n'
    try:
        await asyncio.wait_for(p.communicate(), timeout=.4)
    except asyncio.TimeoutError:
        before = time.monotonic()
        p.kill()
        await asyncio.wait_for(p.communicate(), timeout=3)
        assert time.monotonic() - before < 2
        ids = json.loads(file.read_text())
        wait_for(lambda: dead(ids['native_child']), 2)
        passed('rewardkit_timeout_pattern_returns_promptly_without_late_verdict', elapsed_seconds=round(time.monotonic() - before, 3))
    else:
        raise AssertionError('Fixture should have timed out')

asyncio.run(rewardkit_timeout())
counter = {'writes': 0}

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(counter).encode() if self.path == '/count' else b'<html><head><title>Recovery fixture</title></head><body><h1>Browser recovery</h1></body></html>'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json' if self.path == '/count' else 'text/html')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', '0')))
        counter['writes'] += 1
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(counter).encode())

    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_address[1]}'
proxy = subprocess.Popen(['python3', '/tests/playwright-proxy.py', '--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox'], env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
messages = queue.Queue()

def read_proxy():
    for line in proxy.stdout:
        messages.put(json.loads(line))

threading.Thread(target=read_proxy, daemon=True).start()

def send(obj):
    proxy.stdin.write(json.dumps(obj) + '\n')
    proxy.stdin.flush()

def receive(id, timeout=25):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        message = messages.get(timeout=until-time.monotonic())
        if message.get('id') == id:
            return message
    raise AssertionError('No JSON-RPC reply')

def rpc(id, method, params):
    send({'jsonrpc': '2.0', 'id': id, 'method': method, 'params': params})
    return receive(id)

def call(id, name, args):
    return rpc(id, 'tools/call', {'name': name, 'arguments': args})

send({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'recovery-regression', 'version': '1'}}})
assert 'result' in receive(1)
send({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
names = [t['name'] for t in rpc(2, 'tools/list', {})['result']['tools']]
assert 'browser_navigate' in names
r = call(3, 'browser_navigate', {'url': origin})
assert not r['result'].get('isError')
run = next(n for n in names if n.startswith('browser_run_code'))
r = call(4, run, {'code': 'async(page)=>({url:page.url(),title:await page.title()})'})
assert 'Recovery fixture' in json.dumps(r)
passed('real_playwright_tools_initialize_and_forward_browser_evidence')
events = LOG / 'browser-runtime' / f'{proxy.pid}.jsonl'

def records():
    return [json.loads(l) for l in events.read_text().splitlines()]

first = next(x for x in records() if x['event'] == 'worker_started')['worker_pid']
send({'jsonrpc': '2.0', 'id': 5, 'method': 'tools/call', 'params': {'name': run, 'arguments': {'code': "async(page)=>{await page.request.post('" + origin + "/write',{data:{value:1}});await page.waitForTimeout(20000);return {completed:true};}"}}})
wait_for(lambda: counter['writes'] == 1)
os.kill(first, signal.SIGKILL)
failed = receive(5)
assert failed['result']['isError'] and 'NOT replayed' in json.dumps(failed)
wait_for(lambda: any(e['event'] == 'worker_reinitialized' for e in records()))
r = call(6, 'browser_navigate', {'url': origin})
assert not r['result'].get('isError'), r
r = call(7, run, {'code': "async(page)=>({title:await page.title(),state:await(await page.request.get('" + origin + "/count')).json()})"})
assert 'Recovery fixture' in json.dumps(r) and counter['writes'] == 1
passed('lost_response_recovers_transport_without_replaying_accepted_mutation', writes=counter['writes'])
second = [e['worker_pid'] for e in records() if e['event'] == 'worker_started'][-1]
os.kill(second, signal.SIGKILL)
wait_for(lambda: sum(e['event'] == 'transport_lost' for e in records()) == 2)
r = call(8, 'browser_navigate', {'url': origin})
assert r['result']['isError'] and 'exhausted' in json.dumps(r)
assert len([e for e in records() if e['event'] == 'worker_started']) == 2
passed('recovery_is_bounded_and_unverified_observations_never_become_passes')
proxy.stdin.close()
proxy.wait(timeout=5)
assert proxy.returncode == 0, proxy.stderr.read()
server.shutdown()
(RUNTIME / 'validation.json').write_text(json.dumps({'kind': 'Local actual Playwright transport and synthetic process-tree fixtures, not a model grade', 'evidence_directory': str(OUT), 'passed': True, 'checks': results}, indent=2) + '\n')
