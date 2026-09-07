"""Offline false-pass controls on disposable /app copies, never task source."""
import json
from pathlib import Path
import subprocess
import urllib.request

results = []
for kind in ('destructive_reseed_on_startup', 'missing_manifest_api_routes'):
    subprocess.run(['bash', '/solution/solve.sh'], check=True)
    if kind == 'destructive_reseed_on_startup':
        path = Path('/app/src/db.js')
        source = path.read_text()
        assert source.count('  const existing =') == 1
        path.write_text(source.replace('  const existing =',
            "  db.exec('DELETE FROM revisions; DELETE FROM documents;');\n  const existing =", 1))
    else:
        path = Path('/app/APP_MANIFEST.md')
        path.write_text('\n'.join(line for line in path.read_text().splitlines() if '/api/' not in line) + '\n')
    subprocess.run(['chmod', '-R', 'a+rX', '/app'], check=True)
    subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
    subprocess.run(['bash', '/tests/app-lifecycle.sh', 'start'], check=True)
    try:
        outcome = subprocess.run(['node', '/validation/restart-regression.cjs'], capture_output=True, text=True, timeout=180)
        assert outcome.returncode != 0, 'Broken copy unexpectedly passed: ' + kind
        if kind == 'destructive_reseed_on_startup':
            with urllib.request.urlopen('http://localhost:3000/api/documents/incident-alpha') as response:
                doc = json.load(response)['document']
            assert doc['current_revision'] == 1 and 'PATCHPAD-RESTART-PROOF' not in doc['content']
            assert 'deep-equal' in outcome.stderr
        else:
            assert '/api/documents' in outcome.stderr
        results.append({'mutant': kind, 'rejected': True, 'returncode': outcome.returncode})
        print('PASS negative control: ' + kind)
    finally:
        subprocess.run(['bash', '/tests/app-lifecycle.sh', 'stop'], check=True)
Path('/results/coverage-negative-controls.json').write_text(json.dumps(results, indent=2) + '\n')
