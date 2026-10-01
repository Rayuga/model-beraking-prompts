import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

OUT = Path('/evidence')
TASK = Path('/task')
APP = Path('/app')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
report = {'input_sha256': '6a1e1645d3f5518ba2b935fdb339053a96ae6cbfbaeb48546616d752f3133ca2', 'scope': 'Current frozen installer lifecycle control; no configured judge or provider', 'sources': {str(p.relative_to(TASK)): sha(p) for p in (TASK/'solution').rglob('*') if p.is_file()}, 'observations': []}

def install(label):
    argv = ['bash', str(TASK/'solution/solve.sh')]
    proc = subprocess.run(argv, cwd='/tmp', text=True, capture_output=True, timeout=20)
    (OUT/(label+'-stdout.log')).write_text(proc.stdout)
    (OUT/(label+'-stderr.log')).write_text(proc.stderr)
    row = {'label': label, 'argv': argv, 'cwd': '/tmp', 'exit_code': proc.returncode, 'stderr': proc.stderr}
    report['observations'].append(row)
    return row

def request(path, data=None):
    req = urllib.request.Request('http://127.0.0.1:3000'+path, data=None if data is None else json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=2) as response:
        return response.status, json.load(response)

def start(label, dbpath, nobody=False):
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'NODE_PATH': '/usr/local/lib/node_modules', 'HOME': '/app', 'PORT': '3000', 'DB_PATH': dbpath}
    argv = (['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups'] if nobody else [])+['node', '/app/server.js']
    log = (OUT/(label+'-app.log')).open('w')
    proc = subprocess.Popen(argv, cwd='/tmp', env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    started = time.monotonic()
    for _ in range(100):
        try:
            status, body = request('/api/snippets')
            assert status == 200
            break
        except Exception:
            if proc.poll() is not None:
                raise RuntimeError('server exited: '+label)
            time.sleep(.05)
    else:
        raise RuntimeError('server not ready: '+label)
    health = request('/api/health')
    with urllib.request.urlopen('http://127.0.0.1:3000/', timeout=2) as response:
        root_status = response.status
        html = response.read().decode()
    row = {'label': label, 'argv': argv, 'env': env, 'cwd': '/tmp', 'pid': proc.pid, 'startup_seconds': time.monotonic()-started, 'health_status': health[0], 'health_body': health[1], 'root_status': root_status, 'html_contains_script': '<script' in html, 'saved_records': body, 'selected_database_exists': Path(dbpath).is_file()}
    report['observations'].append(row)
    return proc, log

def stop(proc, log):
    if proc.poll() is None:
        os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=5)
    log.close()

live = None
try:
    syntax = subprocess.run(['bash', '-n', str(TASK/'solution/solve.sh')], capture_output=True, text=True, timeout=10)
    report['bash_syntax_exit_code'] = syntax.returncode
    assert syntax.returncode == 0
    assert install('initial-install')['exit_code'] == 0
    copied = {str(p.relative_to(APP)): sha(p) for p in APP.rglob('*') if p.is_file()}
    expected = {str(p.relative_to(TASK/'solution/app')): sha(p) for p in (TASK/'solution/app').rglob('*') if p.is_file()}
    report['installed_files_match_frozen'] = copied == expected
    assert copied == expected
    live = start('default-start', '/app/app.db')
    status, saved = request('/api/snippets', {'title':'Row 19 durable control','filename':'control.js','code':"console.log('row19');"})
    assert status == 201
    report['saved_control'] = saved
    active = install('active-root-install')
    report['active_root_refused'] = active['exit_code'] != 0 and 'is open' in active['stderr']
    assert report['active_root_refused']
    stop(*live); live = None
    live = start('default-restart', '/app/app.db')
    report['restart_retains_exact_record'] = request('/api/snippets/'+str(saved['id']))[1] == saved
    assert report['restart_retains_exact_record']
    stop(*live); live = None
    assert install('closed-reinstall')['exit_code'] == 0
    for p in [APP, *APP.rglob('*')]:
        os.chown(p, 65534, 65534)
        p.chmod(0o755 if p.is_dir() else 0o644)
    live = start('unprivileged-alternate-start', '/app/alternate/data.sqlite', nobody=True)
    assert request('/api/snippets')[1] == []
    status, saved2 = request('/api/snippets', {'title':'Row 19 alternate control','filename':'alternate.css','code':'body { color: red; }'})
    assert status == 201
    report['alternate_database_created_without_default'] = Path('/app/alternate/data.sqlite').is_file() and not Path('/app/app.db').exists()
    assert report['alternate_database_created_without_default']
    stop(*live); live = None
    live = start('unprivileged-alternate-restart', '/app/alternate/data.sqlite', nobody=True)
    report['alternate_restart_retains_exact_record'] = request('/api/snippets/'+str(saved2['id']))[1] == saved2
    assert report['alternate_restart_retains_exact_record']
    stop(*live); live = None
    live = start('unprivileged-default-start', '/app/app.db', nobody=True)
    status, saved3 = request('/api/snippets', {'title':'Row 19 active unprivileged control','filename':'nobody.js','code':'console.log(19);'})
    assert status == 201
    active_nobody = install('active-unprivileged-install')
    report['active_unprivileged_refused'] = active_nobody['exit_code'] != 0
    report['active_unprivileged_database_still_exists'] = Path('/app/app.db').is_file()
    report['active_unprivileged_record_unchanged'] = request('/api/snippets/'+str(saved3['id']))[1] == saved3
    assert report['active_unprivileged_refused'] and report['active_unprivileged_database_still_exists'] and report['active_unprivileged_record_unchanged']
    stop(*live); live = None
    assert install('closed-unprivileged-reinstall')['exit_code'] == 0
    report['completed'] = True
except Exception as error:
    report['error'] = repr(error)
    report['completed'] = False
finally:
    if live:
        stop(*live)
    (OUT/'RESULTS.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
raise SystemExit(0 if report['completed'] else 1)
