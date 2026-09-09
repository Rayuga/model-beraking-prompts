"""Runs inside the verifier image, offline and without provider credentials."""
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time
import urllib.request

OUT = Path('/results')
env = dict(os.environ, LITELLM_LOCAL_MODEL_COST_MAP='True')
os.environ.update(env)
from rewardkit.runner import discover

evidence = {'scope': 'Unpaid local checks; not a full Oracle or platform QC score'}
evidence['criteria'] = {d.name: len(d.criteria) for d in discover('/tests')}
assert evidence['criteria'] == {'render': 2, 'constraints': 2, 'functional': 27, 'polish': 4}
for script in ('/tests/test.sh', '/tests/app-lifecycle.sh', '/solution/solve.sh'):
    subprocess.run(['bash', '-n', script], check=True)
for script in Path('/solution/app').rglob('*.js'):
    subprocess.run(['node', '--check', str(script)], check=True)
subprocess.run(['bash', '/tests/test.sh'], check=True)
noop = json.loads(Path('/logs/verifier/reward.json').read_text())
assert noop['reward'] == 0 and noop['no_op'] == 1
evidence['syntax_and_empty_submission'] = 'passed'

# Exercise the actual inline parser, including its deletion boundaries.
runner = Path('/tests/test.sh').read_text()
parser = next(block for block in re.findall(r"<<'PY'\n(.*?)\nPY", runner, re.S)
              if 'paths = re.findall' in block)
root = Path('/app')
root.mkdir(exist_ok=True)
(root / 'package.json').write_text(json.dumps({'scripts': {'start': 'node server.js'}}))
fixtures = [
    ('SQLite path: `/app/data/qc.db`', '/app/data/qc.db'),
    ('SQLite path: /app/data/qc.store', '/app/data/qc.store'),
    ('SQLite path: `/app/data/qc`', '/app/data/qc'),
    ('SQLite path: `/app/data/qc with spaces`', '/app/data/qc with spaces'),
    ('SQLite path: `/app/data/qc.db`\nBackup example: /app/backups/example.db', '/app/data/qc.db'),
]
backup = root / 'backups/example.db'
backup.parent.mkdir(parents=True, exist_ok=True)
backup.write_text('preserve')
passed = []
for manifest, db_path in fixtures:
    db = Path(db_path)
    db.parent.mkdir(parents=True, exist_ok=True)
    for suffix in ('', '-wal', '-shm', '-journal'):
        Path(str(db) + suffix).write_text('old database')
    (root / 'APP_MANIFEST.md').write_text(manifest)
    subprocess.run(['python3', '-c', parser], check=True)
    assert all(not Path(str(db) + suffix).exists() for suffix in ('', '-wal', '-shm', '-journal'))
    assert backup.read_text() == 'preserve'
    passed.append(manifest)
for manifest in ('SQLite path: /tmp/outside.db', 'SQLite path: /app/../tmp/outside.db',
                 'SQLite path: /app', 'SQLite path: relative.db',
                 'SQLite path: /app/a\nSQLite path: /app/b', 'No declaration'):
    (root / 'APP_MANIFEST.md').write_text(manifest)
    result = subprocess.run(['python3', '-c', parser], capture_output=True)
    assert result.returncode != 0, manifest
    assert backup.read_text() == 'preserve'
evidence['manifest_parser'] = {'accepted': passed, 'invalid_cases_rejected': 6, 'unrelated_backup_unchanged': True}
backup.unlink()

for script in ('/validation/qc-regression.cjs', '/baseline/browser-smoke.cjs', '/validation/restart-regression.cjs', '/validation/oracle-failures-regression.cjs'):
    subprocess.run(['bash', '/solution/solve.sh'], check=True)
    subprocess.run(['chmod', '-R', 'a+rX', '/app'], check=True)
    subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
    subprocess.run(['bash', '/tests/app-lifecycle.sh', 'start'], check=True)
    try:
        subprocess.run(['node', script, 'patchpad'], check=True, timeout=180)
    finally:
        subprocess.run(['bash', '/tests/app-lifecycle.sh', 'stop'], check=True)
evidence['targeted_browser_regression'] = json.loads((OUT / 'qc-regression.json').read_text())
evidence['baseline_browser_regression'] = json.loads((OUT / 'patchpad-smoke.json').read_text())
evidence['restart_and_manifest_regression'] = json.loads((OUT / 'restart-regression.json').read_text())
evidence['oracle_failure_regressions'] = json.loads((OUT / 'oracle-failures-regression.json').read_text())
(OUT / 'local-validation.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps(evidence, indent=2))
