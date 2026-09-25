import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


helper = Path('/source/tests/evidence.py')
output = Path('/evidence')
output.mkdir(parents=True, exist_ok=True)
temporary = Path(tempfile.mkdtemp(prefix='coursemark-runtime-validation-'))
logs = output / 'verifier-logs'
environment = dict(os.environ, VERIFIER_LOG_DIR=str(logs), CODEX_HOME=str(temporary / 'codex-home'))
results = []


def run(*arguments, data=None, extra=None, check=True):
    return subprocess.run([sys.executable, str(helper), *arguments], input=json.dumps(data, ensure_ascii=False) if data is not None else None, text=True, capture_output=True, env=dict(environment, **(extra or {})), check=check)


def passed(name, **evidence):
    results.append({'name': name, 'passed': True, **evidence})


run('initialize')
payload = {'request': {'method': 'POST', 'path': '/observed/answer', 'body': '{"answer":"line one\\nline two — evidence"}'}, 'response': {'status': 412, 'body': '{"error":"stale","revision":3}\n'}, 'before': {'revision': 3, 'audit': [1, 2]}, 'after': {'revision': 3, 'audit': [1, 2]}, 'outcome': 'observed-pass'}
receipt = json.loads(run('record', 'functional', 'two_tab_revisions_receipts_and_duplicate_guard', 'original-stale-refusal', data=payload).stdout)
stored = json.loads(run('read', 'functional', 'two_tab_revisions_receipts_and_duplicate_guard').stdout)
assert stored[0]['data'] == payload and stored[0]['sequence'] == receipt['recorded'] == 1
passed('multiline_request_status_body_and_baselines_roundtrip', checkpoint=receipt)

spec = importlib.util.spec_from_file_location('evidence_helper', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
os.environ['VERIFIER_LOG_DIR'] = str(logs)
calls = []
original_fsync = module.os.fsync
module.os.fsync = lambda fd: (calls.append(fd), original_fsync(fd))[-1]
module.record('functional', '_handoff', 'candidate-a', {'attempt': 'observed-A', 'released': False})
assert len(calls) == 1
module.os.fsync = original_fsync
run('record', 'functional', '_handoff', 'candidate-b', data={'attempt': 'observed-B', 'released': False})
latest = json.loads(run('read', 'functional', '_handoff', '--latest').stdout)
assert latest['data']['attempt'] == 'observed-B'
passed('fsync_before_success_and_latest_handoff', latest=latest['sequence'])

before = (logs / 'evidence/checkpoints.jsonl').read_bytes()
invalid = run('record', 'functional', 'invented_criterion', 'bad', data={'value': 1}, check=False)
assert invalid.returncode != 0 and (logs / 'evidence/checkpoints.jsonl').read_bytes() == before
assert json.loads(run('read', 'visual', '_handoff', '--latest').stdout) is None
passed('unknown_criterion_rejected_and_missing_evidence_is_not_a_pass')

def simultaneous(index):
    return run('record', 'functional', '_gate', f'concurrent-{index}', data={'index': index}).returncode

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    assert list(pool.map(simultaneous, range(12))) == [0] * 12
records = [json.loads(line) for line in (logs / 'evidence/checkpoints.jsonl').read_text().splitlines()]
assert [item['sequence'] for item in records] == list(range(1, len(records) + 1))
passed('parallel_append_has_no_lost_records_or_duplicate_sequence', records=len(records))

fake = temporary / 'fake-codex'
fake.write_text('#!/usr/bin/env python3\nimport json, os, sys, time\nif os.environ.get("SLEEP_FOR_SIGNAL"):\n print(str(os.getpid()), flush=True)\n time.sleep(120)\nprint(json.dumps({"score": 1, "reasoning": "fixture only"}), flush=True)\nprint("tool result: " + json.dumps({"request": {"path": "/adapted-route"}, "status": 412, "body": "original\\nresponse"}), file=sys.stderr, flush=True)\nraise SystemExit(int(os.environ.get("FIXTURE_EXIT", "0")))\n', encoding='utf-8', newline='\n')
fake.chmod(0o700)
reward_file = logs / 'reward.json'
reward_file.write_text('{"preserved":"not graded by evidence helper"}\n')
expected_reward = reward_file.read_bytes()
for code in (0, 7):
    proc = run('trace-codex', 'exec', 'Prompt version: coursemark-assessment-workspace-functional-v1.0.0-fixture', extra={'COURSEMARK_CODEX_BIN': str(fake), 'FIXTURE_EXIT': str(code)}, check=False)
    assert proc.returncode == code and json.loads(proc.stdout)['reasoning'] == 'fixture only'
    assert 'original\\nresponse' in proc.stderr
files = sorted((logs / 'judge-traces').glob('*.stdout.log'))
assert len(files) == 2 and all(json.loads(path.read_text())['score'] == 1 for path in files)
assert all('original\\nresponse' in path.read_text() for path in (logs / 'judge-traces').glob('*.stderr.log'))
assert reward_file.read_bytes() == expected_reward
passed('transparent_stdout_stderr_and_success_failure_exit_codes', invocations=len(files))

before_trace_count = len(list((logs / 'judge-traces').glob('*.stdout.log')))
run('trace-codex', 'mcp', 'list', extra={'COURSEMARK_CODEX_BIN': str(fake)})
assert len(list((logs / 'judge-traces').glob('*.stdout.log'))) == before_trace_count
passed('non_exec_commands_are_not_logged_or_modified')

for sig in (signal.SIGTERM, signal.SIGKILL):
    proc = subprocess.Popen([sys.executable, str(helper), 'trace-codex', 'exec', 'Prompt version: coursemark-assessment-workspace-polish-v1.0.0-signal'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=dict(environment, COURSEMARK_CODEX_BIN=str(fake), SLEEP_FOR_SIGNAL='1'))
    ready, _, _ = select.select([proc.stdout], [], [], 10)
    assert ready
    reported_pid = int(proc.stdout.readline().strip())
    assert reported_pid == proc.pid
    proc.send_signal(sig)
    proc.communicate(timeout=10)
    assert proc.returncode == -sig
passed('wrapper_exec_preserves_judge_pid_for_term_and_kill_timeout')

session_root = Path(environment['CODEX_HOME']) / 'sessions' / '2026' / '09' / '14'
session_root.mkdir(parents=True)
old = session_root / 'rollout-old.jsonl'
old.write_text('{"old":true}\n')
os.utime(old, (1, 1))
fresh = session_root / 'rollout-current.jsonl'
fresh.write_text('{"type":"response_item","payload":{"type":"function_call_output","output":"real observed checkpoint fixture"}}\n')
(Path(environment['CODEX_HOME']) / 'auth.json').write_text('{"fixture":"must not be exported"}\n')
export = json.loads(run('export-traces').stdout)
assert export['exported'] == 1
assert (logs / export['sessions'][0]['path']).read_bytes() == fresh.read_bytes()
assert not list((logs / 'judge-traces').rglob('auth.json'))
passed('current_session_jsonl_export_excludes_old_sessions_and_auth_config', exported=export['exported'])


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        body = b'<html><body><h1>Evidence fixture</h1><button onclick="fetch(\'/observed-write\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify({revision:2,operation_id:\'evidence-fixture\'})})">Save</button></body></html>'
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.rfile.read(int(self.headers['Content-Length']))
        self.send_response(412)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"error":"stale","revision":3}\n')


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
mcp_log = (output / 'mcp-stderr.log').open('w')
mcp = subprocess.Popen(['playwright-mcp', '--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=mcp_log, text=True, bufsize=1)
counter = 0


def call(method, params):
    global counter
    counter += 1
    mcp.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': counter, 'method': method, 'params': params}) + '\n')
    mcp.stdin.flush()
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        ready, _, _ = select.select([mcp.stdout], [], [], max(0, deadline-time.monotonic()))
        if not ready:
            break
        line = mcp.stdout.readline()
        if not line:
            raise AssertionError('MCP exited')
        response = json.loads(line)
        if response.get('id') == counter:
            assert 'error' not in response, response
            return response['result']
    raise AssertionError('MCP request timed out')


try:
    call('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {}, 'clientInfo': {'name': 'coursemark-evidence-validation', 'version': '1.0.0'}})
    mcp.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n')
    mcp.stdin.flush()
    available = call('tools/list', {})['tools']
    tool = next(item for item in available if 'run_code' in item['name'])
    code = '''async (page) => {
      const checkpoints = [];
      try {
        await page.goto('http://127.0.0.1:PORT/');
        const pending = page.waitForResponse(r => r.url().endsWith('/observed-write'));
        await page.getByRole('button', {name: 'Save', exact: true}).click();
        const response = await pending;
        const request = response.request();
        checkpoints.push({step: 'original-response', request: {method: request.method(), path: request.url(), body: request.postData()}, status: response.status(), body: await response.text(), requireType: typeof require});
        throw new Error('simulated later judge setup error');
      } catch (error) {
        checkpoints.push({step: 'later-step', outcome: 'incomplete', error: String(error)});
      }
      return checkpoints;
    }'''.replace('PORT', str(server.server_port))
    tool_result = call('tools/call', {'name': tool['name'], 'arguments': {'code': code}})
    (output / 'mcp-checkpoint-result.json').write_text(json.dumps(tool_result, indent=2) + '\n')
    serialized = json.dumps(tool_result)
    assert '412' in serialized and 'original-response' in serialized and 'simulated later judge setup error' in serialized and 'evidence-fixture' in serialized and 'undefined' in serialized and not tool_result.get('isError')
    run('record', 'functional', 'two_tab_revisions_receipts_and_duplicate_guard', 'actual-mcp-capture', data={'browser_tool_result': tool_result})
    passed('actual_playwright_mcp_original_request_and_response_survive_later_judge_error', tool=tool['name'], require_available=False)
finally:
    mcp.terminate()
    try:
        mcp.communicate(timeout=10)
    except subprocess.TimeoutExpired:
        mcp.kill()
        mcp.communicate()
    server.shutdown()
    mcp_log.close()

(output / 'validation.json').write_text(json.dumps({'passed': len(results), 'failed': 0, 'scope': 'Evidence transport and transparent trace runtime; no model evaluation', 'checks': results}, indent=2) + '\n')
print(json.dumps({'passed': len(results), 'failed': 0}))
