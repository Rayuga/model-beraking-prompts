"""Independent row-40 checks; synthetic score inputs are not app grades."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tomllib

ROOT = Path.cwd()
FROZEN = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r3'
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
OUT = RUN / 'per-row-review/evidence/40'
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
index_path = RUN / 'raw-evidence-index.json'
index = json.loads(index_path.read_text(encoding='utf-8-sig'))
selected = [
    'verification-local.json',
    'local/configured-inspection/results.json',
    'local/gate-witness/results.json',
    'local/gate-witness.cjs',
    'local/partial-budget-recovery/results.json',
    'local/partial-budget-recovery.cjs',
]
verification = []
for rel in selected:
    path = RUN / rel
    indexed = next(e for e in index['entries'] if e['path'] == path.relative_to(ROOT).as_posix())
    actual = digest(path)
    verification.append({'path': indexed['path'], 'expected': indexed['sha256'], 'actual': actual, 'matches': actual == indexed['sha256']})
bindings = []
for rel, base, key in [
    ('local/configured-inspection/results.json', FROZEN / 'task/tests', 'tests_sha256'),
    ('local/partial-budget-recovery/results.json', FROZEN / 'task/solution', 'source_sha256'),
]:
    declared = json.loads((RUN / rel).read_text())[key]
    bindings.append({'artifact': rel, 'count': len(declared), 'mismatches': [name for name, expected in declared.items() if digest(base / name) != expected]})
inventory = {}
for dim in ('functional', 'polish', 'visual'):
    data = tomllib.loads((FROZEN / f'task/tests/scored/{dim}/judge.toml').read_text())
    inventory[dim] = {'count': len(data['criterion']), 'weight_sum': sum(c['weight'] for c in data['criterion']), 'types': sorted(set(c['type'] for c in data['criterion']))}
cases = [
    ('gate_failure', {'render': 1, 'constraints': 0}, {'functional': .7, 'polish': .8, 'visual': .8}, 0),
    ('at_functional_floor', {'render': 1, 'constraints': 1}, {'functional': .05, 'polish': 1, 'visual': 1}, 0),
    ('partial_low', {'render': 1, 'constraints': 1}, {'functional': .1, 'polish': .4, 'visual': .4}, .22),
    ('partial_medium', {'render': 1, 'constraints': 1}, {'functional': .3, 'polish': .4, 'visual': .4}, .34),
    ('partial_high', {'render': 1, 'constraints': 1}, {'functional': .7, 'polish': .8, 'visual': .8}, .74),
    ('synthetic_maximum', {'render': 1, 'constraints': 1}, {'functional': 1, 'polish': 1, 'visual': 1}, 1),
]
observed = []
scorer = FROZEN / 'task/tests/tools/score.py'
for name, gates, scored, expected in cases:
    folder = OUT / 'synthetic' / name
    for suite, data in [('gates', gates), ('scored', scored)]:
        target = folder / suite
        target.mkdir(parents=True, exist_ok=True)
        (target / 'reward.json').write_text(json.dumps(data) + '\n')
    command = [sys.executable, '-B', str(scorer), str(folder)]
    proc = subprocess.run(command, capture_output=True, text=True)
    result = json.loads((folder / 'reward.json').read_text())
    assert result['reward'] == expected, (name, result, expected)
    observed.append({'case': name, 'command': command, 'exit_code': proc.returncode, 'stdout': proc.stdout, 'stderr': proc.stderr, 'synthetic_dimension_inputs': scored, 'reward': result['reward']})
report = {
    'kind': 'Synthetic score-helper execution and evidence hash/source-binding verification only; no configured judge app rewards or empirical app discrimination',
    'input_sha256': 'cf784fd80eb2bbde1fc76bc223bc4dd9b75279121566847079f982e09473ca01',
    'index_sha256': digest(index_path), 'verified_index_entries': verification, 'source_bindings': bindings,
    'scorer_sha256': digest(scorer), 'canonical_scorer_match': scorer.read_bytes() == (FROZEN / 'rules/projects/webdev-task-template/tests/tools/score.py').read_bytes(),
    'inventory': inventory, 'synthetic_cases': observed,
    'runtime_evidence_exists': (RUN / 'runtime-evidence.json').exists(),
}
assert all(item['matches'] for item in verification)
assert not any(item['mismatches'] for item in bindings)
(OUT / 'observations.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'inventory': inventory, 'synthetic_rewards': [x['reward'] for x in observed], 'index_hashes_match': True, 'source_bindings_match': True, 'configured_app_discrimination_measured': False}, indent=2))
