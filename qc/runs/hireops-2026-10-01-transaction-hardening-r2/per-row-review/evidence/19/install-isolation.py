"""Independent row 19 installer control and unrelated-process counterexample."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

output = Path('/evidence')
results = {'scope': 'Fresh installation with an unrelated unprivileged sleeper; no provider calls.'}
results['solve_sha256'] = hashlib.sha256(Path('/solution/solve.sh').read_bytes()).hexdigest()
results['initial_server_exists'] = Path('/app/server.js').exists()
results['initial_database_exists'] = Path('/app/app.db').exists()
assert not results['initial_server_exists'] and not results['initial_database_exists']
results['syntax'] = subprocess.run(['bash', '-n', '/solution/solve.sh'], capture_output=True, text=True).__dict__.copy()
results['syntax'] = {k: results['syntax'][k] for k in ['args', 'returncode', 'stdout', 'stderr']}
child = subprocess.Popen(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', 'sleep', '30'])
try:
    time.sleep(0.2)
    results['unrelated_child'] = {'pid': child.pid, 'command': ['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups', 'sleep', '30'], 'running': child.poll() is None}
    attempt = subprocess.run(['bash', '/solution/solve.sh'], capture_output=True, text=True, timeout=10)
    results['fresh_with_sleeper'] = {'returncode': attempt.returncode, 'stdout': attempt.stdout, 'stderr': attempt.stderr, 'server_exists': Path('/app/server.js').exists(), 'database_exists': Path('/app/app.db').exists()}
finally:
    child.terminate()
    child.wait(timeout=5)
attempt = subprocess.run(['bash', '/solution/solve.sh'], capture_output=True, text=True, timeout=10)
results['fresh_after_sleeper_exit'] = {'returncode': attempt.returncode, 'stdout': attempt.stdout, 'stderr': attempt.stderr, 'server_exists': Path('/app/server.js').exists()}
assert results['syntax']['returncode'] == 0
assert results['fresh_with_sleeper']['returncode'] != 0
assert not results['fresh_with_sleeper']['server_exists']
assert results['fresh_after_sleeper_exit']['returncode'] == 0 and results['fresh_after_sleeper_exit']['server_exists']
(output / 'install-isolation-result.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
