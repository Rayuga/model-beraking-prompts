from pathlib import Path
import hashlib
import itertools
import json
import os
import subprocess
import sys
import tempfile

out = Path('/results')
for p in ('/tests/test.sh', '/tests/app-lifecycle.sh', '/solution/solve.sh'):
    subprocess.run(['bash', '-n', p], check=True)
first = subprocess.run(['bash', '/tests/test.sh'], capture_output=True, text=True, check=True)
assert json.loads(Path('/logs/verifier/reward.json').read_text())['no_op'] == 1
record = json.loads(Path('/logs/verifier/prompt-provenance.json').read_text())
assert len(record['judges']) == 5 and 'Prompt provenance: ' in first.stdout
for dim, item in record['judges'].items():
    revision = 5 if dim in ('functional', 'polish') else 4
    assert item['prompt_version'] == f'patchpad-editor-v2-{dim}-v1.0.0-r{revision}'
    for key, filename in [('prompt_sha256', 'prompt.md'), ('judge_sha256', 'judge.toml')]:
        assert item[key] == hashlib.sha256(Path('/tests', dim, filename).read_bytes()).hexdigest()
for key, filename in [('runner_sha256', 'test.sh'), ('reward_config_sha256', 'reward.toml')]:
    assert record[key] == hashlib.sha256(Path('/tests', filename).read_bytes()).hexdigest()
subprocess.run(['bash', '/solution/solve.sh'], check=True)
with tempfile.TemporaryDirectory(prefix='patchpad-unpaid-runner-') as temp:
    stub = Path(temp, 'rewardkit')
    stub.write_text('''#!/usr/bin/env python3
import json, urllib.request
from pathlib import Path
with urllib.request.urlopen('http://localhost:3000/') as response:
    assert response.status == 200
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=.8,visual=.6)))
''')
    stub.chmod(0o700)
    run = subprocess.run(['bash', '/tests/test.sh'], env=dict(os.environ, PATH=temp+':'+os.environ['PATH']), capture_output=True, text=True, timeout=120)
    (out/'runner-stdout.txt').write_text(run.stdout)
    (out/'runner-stderr.txt').write_text(run.stderr)
    reward = json.loads(Path('/logs/verifier/reward.json').read_text())
    assert run.returncode == 0 and reward['graded'] == 1 and reward['reward'] == .58, reward
    assert json.loads(Path('/logs/verifier/ctrf.json').read_text())['summary']['total'] == 5
    assert json.loads(Path('/logs/verifier/prompt-provenance.json').read_text()) == record

runner = Path('/tests/test.sh').read_text()
start = runner.index("<<'PY'", runner.index('if ! python3 - "$LOG_DIR/reward.json"')) + len("<<'PY'\n")
code = runner[start:runner.index('\nPY\n', start)]
valid_count = invalid_count = 0
with tempfile.TemporaryDirectory(prefix='patchpad-reward-matrix-') as temp:
    temp = Path(temp)
    program = temp/'postprocess.py'
    program.write_text(code)
    def execute(scores):
        source = temp/'reward.json'
        source.write_text(json.dumps(scores))
        result = subprocess.run([sys.executable, str(program), str(source), str(temp/'reward.txt'), str(temp/'ctrf.json')], capture_output=True, text=True)
        return result, source
    for render, constraints, values in itertools.product((0,.5,1), (0,.5,1), ((0,0,0),(.25,.75,.5),(1,1,1))):
        f,p,v = values
        result, source = execute(dict(render=render,constraints=constraints,functional=f,polish=p,visual=v))
        assert result.returncode == 0, result.stderr
        expected = round(0 if render <= 0 or constraints <= 0 else .6*f+.2*p+.2*v, 4)
        assert json.loads(source.read_text())['reward'] == expected
        assert json.loads((temp/'ctrf.json').read_text())['summary']['total'] == 5
        valid_count += 1
    for dim, value in itertools.product(record['judges'], (None, True, '1', -1, 1.01, float('nan'), float('inf'))):
        scores = dict.fromkeys(record['judges'], 1)
        scores[dim] = value
        assert execute(scores)[0].returncode != 0
        invalid_count += 1
    for dim in record['judges']:
        scores = dict.fromkeys(record['judges'], 1)
        del scores[dim]
        assert execute(scores)[0].returncode != 0
        invalid_count += 1
(out/'prompt-provenance.json').write_text(json.dumps(record, indent=2)+'\n')
report = dict(passed=True, shell_syntax=True, noop_zero=True, all_provenance_hashes_verified=True,
              real_runner_startup=True, injected_reward=.58, valid_reward_cases=valid_count,
              invalid_reward_cases_rejected=invalid_count, paid_judge=False)
(out/'runtime-check.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))
