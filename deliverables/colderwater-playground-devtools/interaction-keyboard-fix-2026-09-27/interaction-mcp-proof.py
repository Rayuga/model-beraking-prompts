import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import subprocess
import time
import urllib.request

evidence = Path('/evidence')
source = Path('/source-task/solution/app')
app = Path('/tmp/cw-interaction-app')
shutil.copytree(source, app)
report = {
    'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'paid_provider': False,
    'network': 'none; browser and server in one disposable container',
    'source_binding': {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest()
                       for p in source.rglob('*') if p.is_file() and (p.name == 'runtime.ts' or p.name == 'app.tsx' or 'public' in p.parts)},
    'chromium_version': subprocess.check_output(['/usr/local/bin/chromium', '--version'], text=True).strip(),
    'mcp_version': subprocess.check_output(['playwright-mcp', '--version'], text=True).strip(),
}
env = dict(os.environ, DB_PATH=str(app / 'proof.db'), NODE_PATH='/usr/local/lib/node_modules')
server_log = (evidence / 'interaction-server.log').open('w', encoding='utf-8')
server = subprocess.Popen(['node', 'server.js'], cwd=app, env=env, stdout=server_log, stderr=subprocess.STDOUT)
for _ in range(100):
    try:
        with urllib.request.urlopen('http://localhost:3000/api/health', timeout=1) as response:
            assert response.status == 200
        break
    except Exception:
        time.sleep(.1)
else:
    raise RuntimeError('Isolated golden server failed to start')
err = (evidence / 'interaction-mcp-stderr.log').open('w', encoding='utf-8')
command = ['playwright-mcp', '--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox']
report['command'] = command
process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err, text=True, bufsize=1)
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)

def call(identifier, method, params):
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': identifier, 'method': method, 'params': params}) + '\n')
    process.stdin.flush()
    deadline = time.monotonic() + 170
    while time.monotonic() < deadline:
        assert selector.select(max(0, deadline - time.monotonic())), 'MCP response timeout'
        line = process.stdout.readline()
        assert line, 'MCP ended'
        reply = json.loads(line)
        if reply.get('id') == identifier:
            assert 'error' not in reply, reply
            assert not reply.get('result', {}).get('isError'), reply
            return reply['result']
    raise AssertionError('MCP response timeout')

try:
    report['initialize'] = call(1, 'initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'colderwater-interaction-proof', 'version': '1'}})
    process.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n')
    process.stdin.flush()
    report['tool'] = next(t for t in call(2, 'tools/list', {})['tools'] if t['name'] == 'browser_run_code_unsafe')
    call(3, 'tools/call', {'name': 'browser_navigate', 'arguments': {'url': 'http://localhost:3000'}})
    code = (evidence / 'interaction-mcp-probe.js').read_text()
    if os.environ.get('CW_LANGUAGE_ONLY') == '1':
        code = code.split('  const savedSource', 1)[0] + '\n  page.__interactionProof = {running:false,passed:observations.every(item=>item.passed),observations};return page.__interactionProof;\n}'
    result = call(4, 'tools/call', {'name': 'browser_run_code_unsafe', 'arguments': {'code': code}})
    report['raw_tool_results'] = [result]
    identifier = 10
    deadline = time.monotonic() + 160
    while time.monotonic() < deadline:
        content = '\n'.join(item.get('text', '') for item in result['content'])
        if '### Result\n' in content:
            payload = content.split('### Result\n', 1)[1].split('\n### ', 1)[0]
            parsed = json.loads(payload)
            if not parsed.get('running', True):
                report['observations'] = parsed
                break
        if 'dialog with message' in content:
            result = call(identifier, 'tools/call', {'name': 'browser_handle_dialog', 'arguments': {'accept': True}})
            identifier += 1
            report['raw_tool_results'].append(result)
        result = call(identifier, 'tools/call', {'name': 'browser_run_code_unsafe', 'arguments': {'code': 'async(page)=>{await page.waitForTimeout(250);return page.__interactionProof;}'}})
        identifier += 1
        report['raw_tool_results'].append(result)
    else:
        raise AssertionError('Proof did not finish after modal handling')
    report['passed'] = report['observations']['passed']
    call(identifier + 1, 'tools/call', {'name': 'browser_close', 'arguments': {}})
except Exception as error:
    report['passed'] = False
    report['error'] = str(error)
finally:
    report['finished_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    result_name = 'language-mcp-results.json' if os.environ.get('CW_LANGUAGE_ONLY') == '1' else 'interaction-mcp-results.json'
    (evidence / result_name).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    process.terminate()
    process.wait(timeout=10)
    server.terminate()
    server.wait(timeout=10)
    err.close()
    server_log.close()
    print(json.dumps({key: report[key] for key in ['passed', 'mcp_version', 'chromium_version']} | {'error': report.get('error'), 'observations': report.get('observations')}, indent=2), flush=True)
    if not report['passed']:
        raise SystemExit(1)
