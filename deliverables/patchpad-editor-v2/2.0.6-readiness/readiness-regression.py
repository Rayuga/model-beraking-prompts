"""Disposable Docker fixtures exercising the real runner; no paid judge calls."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

case = sys.argv[1]
assert case in ('delayed-bind', 'delayed-entry', 'unavailable-entry', 'crash')
app = Path('/app')
app.mkdir(exist_ok=True)
(app/'package.json').write_text(json.dumps({'scripts': {'start': 'node server.js'}}))
(app/'APP_MANIFEST.md').write_text('SQLite path: /app/fixture.db\n')
(app/'server.js').write_text('''
const http = require('node:http');
const started = Date.now();
const mode = ''' + json.dumps(case) + ''';
if (mode === 'crash') process.exit(17);
const server = http.createServer((req,res) => {
  const ready = mode !== 'unavailable-entry' && (mode !== 'delayed-entry' || Date.now()-started > 5000);
  res.statusCode = req.url === '/health' || ready ? 200 : 503;
  res.end(req.url === '/health' ? 'healthy' : ready ? 'ENTRY_READY' : 'starting');
});
setTimeout(() => server.listen(3000, '0.0.0.0'), mode === 'delayed-bind' ? 4000 : 0);
''')
bin_dir = Path('/tmp/readiness-stub')
bin_dir.mkdir()
stub = bin_dir/'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import json, urllib.request
from pathlib import Path
assert urllib.request.urlopen('http://127.0.0.1:3000/').read() == b'ENTRY_READY'
Path('/logs/verifier/stub-invoked').touch()
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1, constraints=1, functional=.5, polish=1)))
''')
stub.chmod(0o700)
started = time.monotonic()
run = subprocess.run(['bash','/tests/test.sh'], env=dict(os.environ, PATH=str(bin_dir)+':'+os.environ['PATH']), capture_output=True, text=True, timeout=130)
elapsed = time.monotonic()-started
assert run.returncode == 0, run.stderr
invoked = Path('/logs/verifier/stub-invoked').exists()
result = json.loads(Path('/logs/verifier/reward.json').read_text())
expected = case in ('delayed-bind','delayed-entry')
assert invoked == expected, (case, invoked)
assert result['graded'] == int(expected)
assert result['reward'] == (.7 if expected else 0)
assert not Path('/logs/verifier/app.pid').exists()
try:
    urllib.request.urlopen('http://127.0.0.1:3000/', timeout=1)
except OSError:
    pass
else:
    raise AssertionError('App survived cleanup')
if case == 'delayed-bind': assert elapsed >= 4
if case == 'delayed-entry': assert elapsed >= 5
if case == 'unavailable-entry': assert 60 <= elapsed < 90
if case == 'crash': assert 45 <= elapsed < 75
report = dict(case=case, passed=True, elapsed_seconds=round(elapsed,2), stub_invoked=invoked, cleanup=True, scope='Local stub harness, not an Oracle grade')
Path('/results/readiness-'+case+'.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
