"""Real runner with trusted local score stub: NOT Oracle/model evaluation."""
import json
import os
from pathlib import Path
import subprocess
import urllib.request

subprocess.run(['bash', '/solution/solve.sh'], check=True)
bin_dir = Path('/tmp/patchpad-score-stub')
bin_dir.mkdir()
stub = bin_dir / 'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import os, sys
from pathlib import Path
if os.environ['STUB_CASE'] == 'crash': sys.exit(17)
Path('/logs/verifier/reward.json').write_text(os.environ['STUB_PAYLOAD'])
''')
stub.chmod(0o700)
valid = dict(render=1, constraints=1, functional=.5, polish=1)
cases = [
    ('valid', json.dumps(valid), .7, 1),
    ('render_gate', json.dumps(dict(valid, render=0)), 0, 1),
    ('constraints_gate', json.dumps(dict(valid, constraints=0)), 0, 1),
    ('missing_dimension', json.dumps({'render': 1}), 0, 0),
    ('invalid_json', 'not json', 0, 0),
    ('boolean_score', json.dumps(dict(valid, functional=True)), 0, 0),
    ('nonfinite_score', json.dumps(dict(valid, functional=float('nan'))), 0, 0),
    ('out_of_range', json.dumps(dict(valid, functional=1.1)), 0, 0),
    ('crash', '{}', 0, 0),
]
results = []
for name, payload, expected, graded in cases:
    env = dict(os.environ, PATH=str(bin_dir)+':'+os.environ['PATH'], STUB_CASE=name, STUB_PAYLOAD=payload)
    run = subprocess.run(['bash', '/tests/test.sh'], env=env, capture_output=True, text=True, timeout=70)
    actual = json.loads(Path('/logs/verifier/reward.json').read_text())
    assert actual['reward'] == expected and actual['graded'] == graded, (name, actual)
    assert float(Path('/logs/verifier/reward.txt').read_text()) == expected
    assert all(key in actual for key in ('render','constraints','functional','polish'))
    assert not Path('/logs/verifier/app.pid').exists()
    try:
        urllib.request.urlopen('http://localhost:3000', timeout=1)
    except OSError:
        pass
    else:
        raise AssertionError('App survived cleanup')
    results.append(dict(case=name, expected_reward=expected, observed=actual, process_cleanup=True))
    print('PASS harness '+name)
Path('/results/harness-matrix.json').write_text(json.dumps(dict(scope='Injected local stub scores, not an Oracle score',results=results),indent=2)+'\n')
