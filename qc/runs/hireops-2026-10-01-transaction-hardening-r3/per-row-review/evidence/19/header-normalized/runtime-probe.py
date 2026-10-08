"""Bounded installer controls and runtime alternatives; no provider or grading call."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

out = Path('/evidence')
results = {'source_hashes': {p.relative_to('/solution').as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/solution').rglob('*') if p.is_file()}, 'checks': []}

def install():
    p = subprocess.run(['bash', '/solution/solve.sh'], capture_output=True, text=True, timeout=10)
    return {'returncode': p.returncode, 'stdout': p.stdout, 'stderr': p.stderr}

def api(port, path, body=None, cookie=None):
    headers = {'Content-Type': 'application/json'}
    if cookie:
        headers['Cookie'] = cookie
    request = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=None if body is None else json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(request, timeout=3) as response:
        return response.status, response.read().decode(), {k.lower(): v for k, v in response.headers.items()}

def wait(port):
    for _ in range(100):
        try:
            return api(port, '/api/health')
        except Exception:
            time.sleep(0.05)
    raise RuntimeError('No health response')

assert not Path('/app/server.js').exists()
fresh = install()
assert fresh['returncode'] == 0, fresh
results['checks'].append({'name': 'fresh_install', **fresh})
subprocess.run(['node', '-e', "const db=new(require('better-sqlite3'))('/app/app.db');db.exec('CREATE TABLE marker(x INTEGER);INSERT INTO marker VALUES(42)');db.close()"], check=True)
closed_hash = hashlib.sha256(Path('/app/app.db').read_bytes()).hexdigest()
sleeper = subprocess.Popen(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', 'sleep', '30'])
try:
    time.sleep(0.1)
    attempted = install()
    results['checks'].append({'name': 'inactive_db_unrelated_unprivileged_sleeper', 'sleeper_running': sleeper.poll() is None, 'database_unchanged': closed_hash == hashlib.sha256(Path('/app/app.db').read_bytes()).hexdigest(), **attempted})
finally:
    sleeper.terminate()
    sleeper.wait(timeout=5)
stopped = install()
assert stopped['returncode'] == 0, stopped
results['checks'].append({'name': 'same_inactive_db_after_sleeper_exit', **stopped})
subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
log = (out / 'app.log').open('w')
env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'NODE_PATH': '/usr/local/lib/node_modules', 'HOME': '/app', 'PORT': '3019', 'DB_PATH': '/app/custom/runtime.db'}
proc = subprocess.Popen(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', 'node', '/app/server.js'], env=env, cwd='/tests', stdout=log, stderr=subprocess.STDOUT)
try:
    health = wait(3019)
    ui = api(3019, '/')
    login = api(3019, '/api/auth/login', {'email': 'rafael.costa@hireops.example', 'password': 'Hireops!2026'})
    cookie = login[2]['set-cookie'].split(';')[0]
    data = json.loads(api(3019, '/api/bootstrap', cookie=cookie)[1])
    assert ui[0] == 200 and '<html' in ui[1].lower()
    assert len(data['users']) == 7
    assert Path('/app/custom/runtime.db').exists() and not Path('/app/app.db').exists()
    results['checks'].append({'name': 'nondefault_port_and_database_without_assets_or_instructions', 'health_status': health[0], 'ui_status': ui[0], 'users': len(data['users']), 'database_override_created': True, 'default_database_absent': True, 'assets_exists': Path('/assets').exists(), 'instructions_exists': Path('/instructions').exists()})
finally:
    proc.terminate()
    proc.wait(timeout=5)
    log.close()
(out / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
