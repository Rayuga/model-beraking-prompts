import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[6]
SNAPSHOT = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r3'
OUT = Path(__file__).resolve().parent
SCORE = SNAPSHOT / 'task/tests/tools/score.py'
cases = [
    ('render_failed_with_perfect_scored', {'render': 0, 'constraints': 1}, {'functional': 1, 'polish': 1, 'visual': 1}, 1, 0),
    ('constraints_failed_with_perfect_scored', {'render': 1, 'constraints': 0}, {'functional': 1, 'polish': 1, 'visual': 1}, 1, 0),
    ('both_gates_failed', {'render': 0, 'constraints': 0}, {'functional': 1, 'polish': 1, 'visual': 1}, 1, 0),
    ('gates_only', {'render': 1, 'constraints': 1}, None, 0, 0),
    ('nonfunctional_polished', {'render': 1, 'constraints': 1}, {'functional': 0, 'polish': 1, 'visual': 1}, 0, 0),
    ('functional_floor_boundary', {'render': 1, 'constraints': 1}, {'functional': .05, 'polish': 1, 'visual': 1}, 0, 0),
    ('just_above_functional_floor', {'render': 1, 'constraints': 1}, {'functional': .0501, 'polish': 1, 'visual': 1}, 0, .4301),
    ('partial_working', {'render': 1, 'constraints': 1}, {'functional': .5, 'polish': .5, 'visual': .5}, 0, .5),
    ('fully_conforming', {'render': 1, 'constraints': 1}, {'functional': 1, 'polish': 1, 'visual': 1}, 0, 1),
]
results = []
for name, gates, scored, expected_exit, expected_reward in cases:
    directory = OUT / 'cases' / name
    (directory / 'gates').mkdir(parents=True, exist_ok=True)
    (directory / 'gates/reward.json').write_text(json.dumps(gates))
    if scored is not None:
        (directory / 'scored').mkdir(exist_ok=True)
        (directory / 'scored/reward.json').write_text(json.dumps(scored))
    command = [sys.executable, '-B', str(SCORE), str(directory)]
    proc = subprocess.run(command, capture_output=True, text=True)
    reward = json.loads((directory / 'reward.json').read_text())
    ctrf = json.loads((directory / 'ctrf.json').read_text())
    assert proc.returncode == expected_exit, (name, proc.returncode)
    assert reward['reward'] == expected_reward, (name, reward)
    if expected_exit == 1:
        assert all(reward[key] == 0 for key in ['functional', 'polish', 'visual'])
        assert all(row['status'] == 'skipped' for row in ctrf['tests'] if row['name'].startswith('scored:'))
    results.append({'case': name, 'command': command, 'exit_code': proc.returncode, 'stdout': proc.stdout, 'stderr': proc.stderr, 'reward': reward, 'ctrf': ctrf})

report = {
    'input_sha256': 'cf784fd80eb2bbde1fc76bc223bc4dd9b75279121566847079f982e09473ca01',
    'scope': 'Direct execution of unchanged frozen score.py on synthetic RewardKit dimension vectors. Not actual app grades, not a full configured judge or shell runtime measurement.',
    'source_sha256': {str(path.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(path.read_bytes()).hexdigest() for path in [SCORE, SNAPSHOT / 'task/tests/scoring.toml', SNAPSHOT / 'task/tests/test.sh']},
    'results': results,
}
(OUT / 'score-results.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'cases': len(results), 'all_assertions_passed': True, 'result': str(OUT / 'score-results.json')}))
