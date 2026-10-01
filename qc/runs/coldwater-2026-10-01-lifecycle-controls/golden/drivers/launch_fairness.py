"""Disposable offline-container launcher; never invoke against a host app."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.request

OUT = Path('/evidence')
TASK = Path('/task')
MANIFEST = OUT / 'frozen_repair_inputs.json'
inputs = json.loads(MANIFEST.read_text())
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
assert inputs['freeze_confirmed'] and len(inputs['criteria']) == 65
assert sha(TASK / 'tests/scored/functional/judge.toml') == inputs['functional_sha256']
assert sha(TASK / 'tests/scored/functional/prompt.md') == inputs['prompt_sha256']
for relative, digest in inputs['solution_files'].items():
    assert sha(TASK / 'solution' / relative) == digest, relative
variant_manifest_path = OUT / 'fairness-variants/variant_binding.json'
variants = json.loads(variant_manifest_path.read_text())
assert variants['manifest_sha256'] == sha(MANIFEST)
assert variants['round_input_sha256'] == inputs['round_input_sha256']
variant_map = {row['name']: row for row in variants['variants']}
cases = ['golden', *variant_map]
if os.environ.get('CW_CASE'):
    assert os.environ['CW_CASE'] in cases
    cases = [os.environ['CW_CASE']]
LOG = OUT / ('focused-' + time.strftime('%Y%m%d-%H%M%S', time.gmtime()))
LOG.mkdir()
shutil.copytree(OUT / 'drivers', LOG / 'drivers')
TEMP = Path(tempfile.mkdtemp(prefix='cw-fairness-', dir='/tmp'))
report = {
    'scope': 'Focused scripted browser counterexamples; not full configured judge, reward, or Oracle evidence',
    'provider_or_platform': False,
    'network': 'none',
    'round_input_sha256': inputs['round_input_sha256'],
    'manifest_sha256': sha(MANIFEST),
    'variant_binding_sha256': sha(variant_manifest_path),
    'driver_sha256': {file.name: sha(file) for file in (LOG / 'drivers').iterdir() if file.is_file()},
    'started_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'chromium': subprocess.check_output(['/usr/local/bin/chromium', '--version'], text=True).strip(),
    'cases': [],
}
clock = time.monotonic()
for case in cases:
    row = {'case': case}
    case_log = LOG / case
    case_log.mkdir()
    app = TEMP / case / 'app'
    source = TASK / 'solution/app' if case == 'golden' else OUT / 'fairness-variants' / case / 'app'
    expected = {key[4:]: value for key, value in inputs['solution_files'].items() if key.startswith('app/')} if case == 'golden' else variant_map[case]['app_files']
    actual = {file.relative_to(source).as_posix(): sha(file) for file in source.rglob('*') if file.is_file()}
    assert actual == expected, 'Variant byte drift: ' + case
    row['actual_app_files'] = actual
    shutil.copytree(source, app)
    # tempfile's 0700 parent would block the intentionally unprivileged server.
    TEMP.chmod(0o755)
    app.parent.chmod(0o755)
    for file in [app, *app.rglob('*')]:
        os.chown(file, 65534, 65534)
        file.chmod(0o755 if file.is_dir() else 0o644)
    env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'NODE_PATH': '/usr/local/lib/node_modules', 'HOME': str(app), 'DB_PATH': str(app / 'app.db'), 'PORT': '3000'}
    server_log = (case_log / 'app.log').open('w')
    server = subprocess.Popen(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', 'node', str(app / 'server.js')], cwd='/tmp', env=env, start_new_session=True, stdout=server_log, stderr=subprocess.STDOUT)
    row['server_pid'] = server.pid
    started = time.monotonic()
    try:
        for _ in range(100):
            if server.poll() is not None:
                raise RuntimeError('Disposable server exited: ' + str(server.returncode))
            try:
                with urllib.request.urlopen('http://localhost:3000/api/health', timeout=1) as response:
                    assert response.status == 200
                break
            except Exception:
                time.sleep(.1)
        else:
            raise RuntimeError('Disposable server did not become healthy')
        probe_env = dict(os.environ, CW_CASE=case, CW_INPUTS=str(MANIFEST), CW_LOG_DIR=str(case_log))
        proc = subprocess.run(['node', str(LOG / 'drivers/fairness_probe.cjs')], env=probe_env, capture_output=True, text=True, timeout=180)
        (case_log / 'output.log').write_text(proc.stdout + proc.stderr)
        row['node_returncode'] = proc.returncode
        result_file = case_log / 'focused-results.json'
        row['browser'] = json.loads(result_file.read_text()) if result_file.exists() else {'passed': False, 'error': 'Browser report absent'}
        row['passed'] = proc.returncode == 0 and row['browser'].get('passed') is True
    except Exception as error:
        row['passed'] = False
        row['error'] = str(error)
    finally:
        if server.poll() is None:
            os.killpg(server.pid, signal.SIGTERM)
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(server.pid, signal.SIGKILL)
                server.wait(timeout=5)
        server_log.close()
        row['wall_seconds'] = time.monotonic() - started
        report['cases'].append(row)
        (case_log / 'RESULTS.json').write_text(json.dumps(row, indent=2) + '\n')
        print(json.dumps({'case': case, 'passed': row['passed'], 'wall_seconds': row['wall_seconds'], 'expectations': row.get('browser', {}).get('expectations'), 'error': row.get('error')}), flush=True)
report['passed'] = all(row['passed'] for row in report['cases'])
report['wall_seconds'] = time.monotonic() - clock
report['finished_at'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
(LOG / 'RESULTS.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'passed': report['passed'], 'log_directory': LOG.name, 'wall_seconds': report['wall_seconds']}), flush=True)
if not report['passed']:
    raise SystemExit(1)
