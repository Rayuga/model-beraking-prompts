from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile

for p in ('/tests/test.sh','/tests/app-lifecycle.sh','/solution/solve.sh'):
    subprocess.run(['bash','-n',p],check=True)
first = subprocess.run(['bash','/tests/test.sh'],capture_output=True,text=True,check=True)
assert json.loads(Path('/logs/verifier/reward.json').read_text())['no_op'] == 1
record = json.loads(Path('/logs/verifier/prompt-provenance.json').read_text())
assert len(record['judges']) == 5
assert 'Prompt provenance: ' in first.stdout
for dim, item in record['judges'].items():
    assert item['task_version'] == '1.0.0'
    assert item['prompt_version'] == f'patchpad-editor-v2-{dim}-v1.0.0-r1'
    for key, filename in [('prompt_sha256','prompt.md'),('judge_sha256','judge.toml')]:
        assert item[key] == hashlib.sha256(Path('/tests',dim,filename).read_bytes()).hexdigest()
for key, filename in [('runner_sha256','test.sh'),('reward_config_sha256','reward.toml')]:
    assert record[key] == hashlib.sha256(Path('/tests',filename).read_bytes()).hexdigest()
subprocess.run(['bash','/solution/solve.sh'],check=True)
stubdir = Path(tempfile.mkdtemp(prefix='patchpad-provenance-check-'))
stub = stubdir/'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
subprocess.run(['node','/results/check-line-numbers.cjs'],check=True)
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=.8,visual=.6)))
''')
stub.chmod(0o700)
run = subprocess.run(['bash','/tests/test.sh'],env=dict(os.environ,PATH=str(stubdir)+':'+os.environ['PATH']),capture_output=True,text=True,timeout=100)
Path('/results/runner-stdout.txt').write_text(run.stdout)
Path('/results/runner-stderr.txt').write_text(run.stderr)
Path('/results/judge-stub-output.txt').write_text(Path('/logs/verifier/rewardkit.log').read_text())
reward = json.loads(Path('/logs/verifier/reward.json').read_text())
assert run.returncode == 0 and reward['graded'] == 1 and reward['reward'] == .58, reward
assert json.loads(Path('/logs/verifier/ctrf.json').read_text())['summary']['total'] == 5
again = json.loads(Path('/logs/verifier/prompt-provenance.json').read_text())
assert record == again
assert 'Prompt provenance: ' in run.stdout
Path('/results/prompt-provenance.json').write_text(json.dumps(again,indent=2)+'\n')
Path('/results/runtime-check.json').write_text(json.dumps(dict(passed=True,shell_syntax=True,noop_zero=True,all_provenance_hashes_verified=True,provenance_in_stdout=True,five_dimension_ctrf=True,injected_reward=.58,real_llm_oracle=False,source='Fresh offline container; exact current runner and golden source; cached image'),indent=2)+'\n')
print('PASS runner startup, no-op, provenance file/stdout, exact file hashes, injected final reward and five-dimension CTRF')
