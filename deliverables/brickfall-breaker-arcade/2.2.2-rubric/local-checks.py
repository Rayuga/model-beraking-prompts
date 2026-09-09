"""Run in a disposable offline verifier container; never invoke a paid judge."""
import json
import os
from pathlib import Path
import subprocess

os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
from rewardkit.runner import discover
criteria = {d.name:len(d.criteria) for d in discover('/tests')}
assert criteria == dict(render=2,constraints=2,functional=16,polish=7), criteria
for script in ('/solution/solve.sh','/tests/test.sh'):
    subprocess.run(['bash','-n',script],check=True)
subprocess.run(['node','--check','/solution/app/server.js'],check=True)
subprocess.run(['bash','/tests/test.sh'],check=True)
assert json.loads(Path('/logs/verifier/reward.json').read_text())['no_op'] == 1
subprocess.run(['bash','/solution/solve.sh'],check=True)
stubdir=Path('/tmp/brickfall-local-stub');stubdir.mkdir()
stub=stubdir/'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
subprocess.run(['node','/results/browser-regression.cjs'],check=True,timeout=180)
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=1)))
''')
stub.chmod(0o700)
subprocess.run(['bash','/tests/test.sh'],check=True,timeout=220,env=dict(os.environ,PATH=str(stubdir)+':'+os.environ['PATH']))
result=json.loads(Path('/logs/verifier/reward.json').read_text())
assert result['graded']==1 and result['reward']==.7, Path('/logs/verifier/rewardkit.log').read_text()
Path('/results/local-checks.json').write_text(json.dumps(dict(criteria=criteria,syntax=True,noop_zero=True,golden_runner=True,injected_aggregate=.7,scope='Local stub score is not an Oracle score'),indent=2)+'\n')
print(Path('/logs/verifier/rewardkit.log').read_text())
print('PASS syntax, discovery, no-op, golden runner and local-stub aggregation')
