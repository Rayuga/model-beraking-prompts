import hashlib
import json
import os
from pathlib import Path
import select
import shutil
import signal
import subprocess
import time
import urllib.request

out = Path('/evidence')
binding = {str(p.relative_to('/task')): hashlib.sha256(p.read_bytes()).hexdigest()
           for p in Path('/task').rglob('*') if p.is_file()}
(out / 'source-binding.json').write_text(json.dumps(binding, indent=2) + '\n')
shutil.copytree('/task/solution/app', '/app')
for root, dirs, files in os.walk('/app'):
    os.chown(root, 65534, 65534)
    for name in files:
        os.chown(Path(root) / name, 65534, 65534)
app_log = (out / 'app.log').open('w')
app = subprocess.Popen(['node', '/app/server.js'], cwd='/tmp', user=65534,
    group=65534, extra_groups=[], start_new_session=True, stdout=app_log,
    stderr=subprocess.STDOUT, env={'PATH': '/usr/local/bin:/usr/bin:/bin',
    'NODE_PATH': '/usr/local/lib/node_modules', 'HOME': '/app', 'PORT': '3000',
    'DB_PATH': '/app/app.db'})
mcp = None
raw = []
result = {'provider_invoked': False, 'configured_judge_invoked': False,
          'scope': 'Actual MCP protocol and gate-operation feasibility only; no grade.'}
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/health', timeout=1) as r:
                result['health_status'] = r.status
            break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('App not ready')
    argv = ['playwright-mcp', '--headless', '--isolated',
            '--executable-path=/usr/local/bin/chromium', '--no-sandbox']
    result['mcp_argv'] = argv
    mcp_log = (out / 'mcp-stderr.log').open('w')
    mcp = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                           stderr=mcp_log, text=True, bufsize=1)
    sequence = 0
    def request(method, params, notification=False):
        global sequence
        sequence += 1
        msg = {'jsonrpc': '2.0', 'method': method, 'params': params}
        if not notification:
            msg['id'] = sequence
        raw.append({'direction': 'sent', 'message': msg})
        mcp.stdin.write(json.dumps(msg) + '\n')
        mcp.stdin.flush()
        if notification:
            return
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if not select.select([mcp.stdout], [], [], 1)[0]:
                continue
            line = mcp.stdout.readline()
            if not line:
                raise RuntimeError('MCP closed stdout')
            reply = json.loads(line)
            raw.append({'direction': 'received', 'message': reply})
            if reply.get('id') == sequence:
                if 'error' in reply:
                    raise RuntimeError(reply)
                return reply['result']
        raise TimeoutError(method)
    result['initialize'] = request('initialize', {'protocolVersion': '2024-11-05',
        'capabilities': {}, 'clientInfo': {'name': 'row29-feasibility', 'version': '1.0'}})
    request('notifications/initialized', {}, True)
    listing = request('tools/list', {})
    result['tool_names'] = [t['name'] for t in listing['tools']]
    assert 'browser_run_code_unsafe' in result['tool_names'], result['tool_names']
    result['navigate'] = request('tools/call', {'name': 'browser_navigate',
        'arguments': {'url': 'http://localhost:3000'}})
    code = (out / 'callback.js').read_text()
    result['gate_callback'] = request('tools/call', {'name': 'browser_run_code_unsafe',
        'arguments': {'code': code}})
    assert not result['gate_callback'].get('isError'), result['gate_callback']
    result['completed'] = True
except Exception as e:
    result['error'] = repr(e)
    result['completed'] = False
finally:
    (out / 'raw-mcp.json').write_text(json.dumps(raw, indent=2) + '\n')
    (out / 'observations.json').write_text(json.dumps(result, indent=2) + '\n')
    if mcp:
        mcp.terminate()
        try:
            mcp.wait(timeout=5)
        except subprocess.TimeoutExpired:
            mcp.kill()
            mcp.wait()
    os.killpg(app.pid, signal.SIGTERM)
    app.wait(timeout=5)
print(json.dumps({'completed': result.get('completed'), 'error': result.get('error')}))
raise SystemExit(0 if result.get('completed') else 1)
