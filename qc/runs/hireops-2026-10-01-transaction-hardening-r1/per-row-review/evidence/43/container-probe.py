"""Execute unchanged frozen test.sh with a synthetic local RewardKit stub."""
import hashlib
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

source = Path('/source/tests')
out = Path('/evidence')
cases = [
    ('failed-render-max-scores', {'render': 0, 'constraints': 1}, {'functional': 1, 'polish': 1, 'visual': 1}, 0, ['gates']),
    ('failed-constraints-max-scores', {'render': 1, 'constraints': 0}, {'functional': 1, 'polish': 1, 'visual': 1}, 0, ['gates']),
    ('gates-only-no-function', {'render': 1, 'constraints': 1}, {'functional': 0, 'polish': 0, 'visual': 0}, 0, ['gates', 'scored']),
    ('zero-function-max-craft', {'render': 1, 'constraints': 1}, {'functional': 0, 'polish': 1, 'visual': 1}, 0, ['gates', 'scored']),
    ('at-floor-max-craft', {'render': 1, 'constraints': 1}, {'functional': .05, 'polish': 1, 'visual': 1}, 0, ['gates', 'scored']),
    ('above-floor-max-craft', {'render': 1, 'constraints': 1}, {'functional': .05001, 'polish': 1, 'visual': 1}, .43, ['gates', 'scored']),
    ('function-only', {'render': 1, 'constraints': 1}, {'functional': 1, 'polish': 0, 'visual': 0}, .6, ['gates', 'scored']),
    ('fully-passing', {'render': 1, 'constraints': 1}, {'functional': 1, 'polish': 1, 'visual': 1}, 1, ['gates', 'scored']),
    ('malformed-render', {'render': True, 'constraints': 1}, {'functional': 1, 'polish': 1, 'visual': 1}, 0, ['gates']),
]
Path('/assets').mkdir(exist_ok=True)
Path('/app').mkdir(exist_ok=True)
Path('/app/server.js').write_text("require('node:http').createServer((req,res)=>{res.end('synthetic liveness fixture');}).listen(3000);\n")
shutil.copyfile(out / 'rewardkit-stub.py', '/usr/local/bin/rewardkit')
Path('/usr/local/bin/rewardkit').chmod(0o755)
results = []
for name, gates, scored, expected, suites in cases:
    shutil.copytree(source, Path('/tests'), dirs_exist_ok=True)
    log = out / name
    log.mkdir()
    env = dict(os.environ, VERIFIER_LOG_DIR=str(log), ROW43_CASE=json.dumps({'gates': gates, 'scored': scored}), REWARDKIT_JUDGE='local-synthetic-stub', REWARDKIT_MODEL='no-provider')
    start = time.monotonic()
    proc = subprocess.run(['bash', '/tests/test.sh'], env=env, capture_output=True, text=True, timeout=30)
    duration = time.monotonic() - start
    (log / 'harness.stdout').write_text(proc.stdout)
    (log / 'harness.stderr').write_text(proc.stderr)
    reward = json.loads((log / 'reward.json').read_text())
    invoked = [json.loads(x)['suite'] for x in (log / 'suite-invocations.jsonl').read_text().splitlines()]
    assertions = {'return_code_zero': proc.returncode == 0, 'expected_reward': reward['reward'] == expected, 'expected_suite_order': invoked == suites, 'scored_directory_matches_invocation': (log / 'scored').exists() == ('scored' in suites), 'reward_text_matches': float((log / 'reward.txt').read_text()) == expected}
    results.append({'case': name, 'inputs': {'gates': gates, 'scored': scored}, 'return_code': proc.returncode, 'duration_seconds': duration, 'suite_order': invoked, 'reward': reward, 'assertions': assertions})
    assert all(assertions.values()), results[-1]
record = {'classification': 'Local synthetic orchestration with exact frozen test.sh and score.py; no configured judge, app score, Oracle or model grade', 'input_sha256': '6e0b8d2fb655781b3dbd8f4bde8d064dd48f8f7671ecd87f6a2db22b5c0aa8a1', 'source_sha256': {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in (source/'test.sh', source/'tools/score.py', source/'scoring.toml')}, 'cases': results, 'passed': True}
(out / 'orchestration-results.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
