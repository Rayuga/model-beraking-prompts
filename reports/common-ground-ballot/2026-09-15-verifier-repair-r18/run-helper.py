"""Disposable exported-app reproduction; no model/provider calls or source edits."""
import hashlib
import os
import json
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

destination = Path('/app')
destination.mkdir(exist_ok=True)
shutil.copytree('/exported-app', destination, dirs_exist_ok=True)
files = {str(file.relative_to(destination)): hashlib.sha256(file.read_bytes()).hexdigest()
         for file in destination.rglob('*') if file.is_file()}
Path('/results/copied-app-hashes.json').write_text(json.dumps(files, indent=2), encoding='utf-8')
subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
subprocess.run(['python3', '/tests/app-lifecycle.py', 'start', '--entry', '/app/server.js',
                '--database', '/app/commonground.db', '--seed', '/app/common_ground_seed.json'], check=True)
try:
    for attempt in range(60):
        try:
            if urllib.request.urlopen('http://localhost:3000/api/health', timeout=1).status == 200:
                break
        except OSError:
            time.sleep(.25)
    else:
        raise RuntimeError('Copied Oracle app failed to start')
    subprocess.run(['node', '/validation/helper-integration.cjs'] + (['--boundary-only'] if os.environ.get('HELPER_BOUNDARY_ONLY') else []), check=True, timeout=500)
finally:
    subprocess.run(['python3', '/tests/app-lifecycle.py', 'stop'], check=True)
