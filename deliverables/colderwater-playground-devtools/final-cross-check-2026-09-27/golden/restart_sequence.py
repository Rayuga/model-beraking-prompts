import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import urllib.request
import zipfile

OUT = Path('/evidence')
LOG = OUT / ('restart-logs-' + time.strftime('%Y%m%d-%H%M%S', time.gmtime()))
LOG.mkdir()
ARCHIVE = Path('/delivery/colderwater-playground-devtools.zip')
EXPECTED = 'a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1'
assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == EXPECTED
ROOT = Path('/tmp/cw-final-golden')
ROOT.mkdir()
with zipfile.ZipFile(ARCHIVE) as z:
    for name in z.namelist():
        dest = (ROOT / name).resolve()
        assert dest.is_relative_to(ROOT)
    z.extractall(ROOT)
TASK = ROOT / 'colderwater-playground-devtools'
APP = TASK / 'solution/app'
for path in [APP, *APP.rglob('*')]:
    os.chown(path, 65534, 65534)
    path.chmod(0o755 if path.is_dir() else 0o644)
report = {'archive_sha256': EXPECTED, 'paid_provider': False, 'log_directory': LOG.name,
          'scope': 'Fresh continuous gate/save_load/early actual MCP process restart/downstream dirty second editor. Browser actions use pinned direct Playwright; restart uses exact delivered restart_mcp.py and generated helper.',
          'source_sha256': {str(p.relative_to(APP)): hashlib.sha256(p.read_bytes()).hexdigest() for p in APP.rglob('*') if p.is_file()},
          'chromium': subprocess.check_output(['/usr/local/bin/chromium', '--version'], text=True).strip(),
          'mcp': subprocess.check_output(['playwright-mcp', '--version'], text=True).strip(),
          'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
server_log = (LOG / 'app.log').open('w')
env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'NODE_PATH': '/usr/local/lib/node_modules',
       'HOME': str(APP), 'PORT': '3000', 'DB_PATH': str(APP / 'app.db')}
server = subprocess.Popen(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups',
                           'node', str(APP / 'server.js')], cwd=APP, env=env,
                          start_new_session=True, stdout=server_log, stderr=subprocess.STDOUT)
(LOG / 'app.pid').write_text(str(server.pid))
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/snippets', timeout=1) as r:
                assert r.status == 200
            break
        except Exception:
            time.sleep(.1)
    else:
        raise AssertionError('Server did not become ready')
    text = (TASK / 'tests/test.sh').read_text()
    helper = text.split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n', 1)[1].split('\nSH\n', 1)[0]
    for key, value in {'__LOG_DIR__': str(LOG), '__APP_ENTRY__': str(APP / 'server.js'),
                       '__APP_COPY__': str(APP), '__APP_DB__': str(APP / 'app.db')}.items():
        helper = helper.replace(key, value)
    helper_path = LOG / 'app-restart.sh'
    helper_path.write_text(helper + '\n')
    helper_path.chmod(0o755)
    report['restart_helper_sha256'] = hashlib.sha256(helper_path.read_bytes()).hexdigest()
    report['restart_mcp_sha256'] = hashlib.sha256((TASK / 'tests/tools/restart_mcp.py').read_bytes()).hexdigest()
    probe_env = dict(os.environ, CW_RESTART_LOG_DIR=str(LOG))
    before = subprocess.run(['node', '/evidence/restart_sequence.cjs', 'prepare'], text=True, capture_output=True, timeout=120, env=probe_env)
    (LOG / 'prepare-output.log').write_text(before.stdout + before.stderr)
    assert before.returncode == 0, before.stdout + before.stderr
    report['prepare'] = json.loads(before.stdout)
    requests = [{'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {}},
                {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}},
                {'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call', 'params': {'name': 'restart_app', 'arguments': {}}}]
    report['pid_before'] = int((LOG / 'app.pid').read_text())
    mcp = subprocess.run(['python3', str(TASK / 'tests/tools/restart_mcp.py'), str(helper_path)],
                         input=''.join(json.dumps(x)+'\n' for x in requests), text=True,
                         capture_output=True, timeout=60, check=True)
    report['restart_mcp_responses'] = [json.loads(line) for line in mcp.stdout.splitlines()]
    assert not report['restart_mcp_responses'][-1]['result']['isError'], report['restart_mcp_responses'][-1]
    report['pid_after'] = int((LOG / 'app.pid').read_text())
    assert report['pid_after'] != report['pid_before']
    server.wait(timeout=5)
    after = subprocess.run(['node', '/evidence/restart_sequence.cjs', 'verify'], text=True, capture_output=True, timeout=120, env=probe_env)
    (LOG / 'verify-output.log').write_text(after.stdout + after.stderr)
    assert after.returncode == 0, after.stdout + after.stderr
    report['verify'] = json.loads(after.stdout)
    report['passed'] = True
except Exception as error:
    report['passed'] = False
    report['error'] = str(error)
finally:
    for pid in {server.pid, int((LOG / 'app.pid').read_text())}:
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    server_log.close()
    report['finished_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (OUT / 'restart_sequence_results.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ['source_sha256', 'restart_mcp_responses']}, indent=2))
    if not report['passed']:
        raise SystemExit(1)
