"""Isolated row 19 runtime evidence; no provider calls or source changes."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

def invoke(args):
    p = subprocess.run(args, text=True, capture_output=True, timeout=20)
    assert p.returncode == 0, (args, p.stdout, p.stderr)
    return p

invoke(['bash', '-n', '/solution/solve.sh'])
invoke(['bash', '/solution/solve.sh'])
source = {p.relative_to('/solution/app').as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
          for p in Path('/solution/app').rglob('*') if p.is_file()}
assert all(hashlib.sha256((Path('/app') / name).read_bytes()).hexdigest() == digest
           for name, digest in source.items())
db = Path('/tmp/row19-db/overridden.sqlite')
db.parent.mkdir()
invoke(['chown', '-R', '65534:65534', '/app', str(db.parent)])

def api(route, body=None, cookie=None):
    headers = {'Content-Type': 'application/json'}
    if cookie:
        headers['Cookie'] = cookie
    req = urllib.request.Request('http://127.0.0.1:3191' + route,
        data=None if body is None else json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.load(r), r.headers

def launch():
    p = subprocess.Popen(['env', '-i', 'PATH=/usr/local/bin:/usr/bin:/bin',
        'NODE_PATH=/usr/local/lib/node_modules', 'HOME=/app', 'PORT=3191',
        'DB_PATH=' + str(db), 'setpriv', '--reuid=65534', '--regid=65534',
        '--clear-groups', 'node', '/app/server.js'], cwd='/tests',
        start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    for _ in range(100):
        try:
            assert api('/api/health')[0]['ok'] is True
            return p
        except Exception:
            if p.poll() is not None:
                raise AssertionError(p.stderr.read().decode())
            time.sleep(.05)
    raise AssertionError('Health timeout')

def login():
    _, headers = api('/api/auth/login',
        {'email': 'rafael.costa@hireops.example', 'password': 'Hireops!2026'})
    return headers['Set-Cookie'].split(';')[0]

def stop(p):
    os.killpg(p.pid, signal.SIGTERM)
    p.wait(timeout=5)

p = launch()
try:
    cookie = login()
    before = api('/api/bootstrap', cookie=cookie)[0]
    assert len(before['requisitions']) == 7 and len(before['offers']) == 13
    api('/api/requisitions', {'id': 'row19-db-path', 'title': 'Row 19 override',
        'dept': 'Engineering', 'budget_cents': 100000}, cookie)
    saved = api('/api/requisitions/row19-db-path', cookie=cookie)[0]
    assert db.exists() and not Path('/app/app.db').exists()
finally:
    stop(p)

p = launch()
try:
    cookie = login()
    retained = api('/api/requisitions/row19-db-path', cookie=cookie)[0]
    after = api('/api/bootstrap', cookie=cookie)[0]
    assert retained == saved
    assert len(after['requisitions']) == 8 and len(after['offers']) == 13
finally:
    stop(p)

print(json.dumps({'row': 19, 'input_sha256':
    '6e0b8d2fb655781b3dbd8f4bde8d064dd48f8f7671ecd87f6a2db22b5c0aa8a1',
    'node_version': invoke(['node', '--version']).stdout.strip(),
    'solve_sha256': hashlib.sha256(Path('/solution/solve.sh').read_bytes()).hexdigest(),
    'app_sha256': source, 'bash_syntax': True, 'fresh_install_exact_copy': True,
    'sanitized_uid': 65534, 'working_directory': '/tests', 'port': 3191,
    'database_override': str(db), 'default_database_absent': True,
    'fresh_counts': [7, 13], 'post_restart_counts': [8, 13],
    'saved_record_retained': retained == saved,
    'scope': 'Installer and direct process runtime only; no configured judge score.'}, indent=2))
