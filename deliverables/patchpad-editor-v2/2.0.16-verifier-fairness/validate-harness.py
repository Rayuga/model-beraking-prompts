"""Test test.sh orchestration with a trusted local stub, not a judge score."""
import json
import os
from pathlib import Path
import subprocess
import urllib.request

subprocess.run(['bash', '/solution/solve.sh'], check=True)
bin_dir = Path('/tmp/harness-test-bin')
bin_dir.mkdir(exist_ok=True)
stub = bin_dir / 'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
subprocess.run(['bash', '/tests/app-lifecycle.sh', 'restart'], check=True)
subprocess.run(['bash', '/tests/app-lifecycle.sh', 'restart'], check=True)
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1, constraints=1, functional=.5, polish=1)))
''')
stub.chmod(0o700)
env = dict(os.environ, PATH=str(bin_dir) + ':' + os.environ['PATH'])
subprocess.run(['bash', '/tests/test.sh'], env=env, check=True, timeout=150)
result = json.loads(Path('/logs/verifier/reward.json').read_text())
assert result['reward'] == .55 and result['graded'] == 1
assert not Path('/logs/verifier/app.pid').exists()
try:
    urllib.request.urlopen('http://127.0.0.1:3000/', timeout=1)
except OSError:
    pass
else:
    raise AssertionError('Restarted server survived harness cleanup')
Path('/results/harness-integration.json').write_text(json.dumps({
    'scope': 'Trusted stub exercises harness lifecycle and score aggregation; NOT an Oracle grade',
    'two_restarts_and_final_cleanup': 'passed',
    'injected_dimension_scores': dict(render=1, constraints=1, functional=.5, polish=1),
    'expected_aggregate': .55, 'observed_aggregate': result['reward'],
}, indent=2) + '\n')
print('PASS harness restart integration, final process cleanup, and 90/10 score aggregation')
