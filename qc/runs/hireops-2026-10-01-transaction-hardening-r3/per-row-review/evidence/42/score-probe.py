"""Synthetic aggregator exercise only; not app judging or measured app ranking."""
from pathlib import Path
import hashlib
import itertools
import json
import runpy
import sys
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
TASK = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r3/task'
OUT = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
index = RUN / 'raw-evidence-index.json'
raw = json.loads(index.read_text(encoding='utf-8-sig'))
checks = []
for entry in raw['entries']:
    p = ROOT / entry['path']
    actual = sha(p) if p.is_file() else None
    checks.append({'path': entry['path'], 'expected': entry['sha256'], 'actual': actual, 'matches': actual == entry['sha256']})
bindings = []
inspection = json.loads((RUN / 'local/configured-inspection/results.json').read_text())
for name, expected in inspection['tests_sha256'].items():
    actual = sha(TASK / 'tests' / name)
    bindings.append({'path': 'tests/' + name, 'expected': expected, 'actual': actual, 'matches': actual == expected})
for variant in ['golden', 'empty_operational_seed']:
    observation = json.loads((RUN / f'local/batch-witnesses/{variant}/results.json').read_text())
    for name, expected in observation['source_sha256'].items():
        actual = sha(TASK / 'solution/app/src' / name)
        bindings.append({'variant': variant, 'path': 'solution/app/src/' + name, 'expected': expected, 'actual': actual, 'matches': actual == expected})
module = runpy.run_path(str(TASK / 'tests/tools/score.py'))
grid = [[0, 1], [0, 1], [0, 0.04999, 0.05, 0.05001, 0.1, 0.5, 1], [0, 0.5, 1], [0, 0.5, 1]]
rows = []
with tempfile.TemporaryDirectory(prefix='row42-score-') as temporary:
    logs = Path(temporary)
    (logs / 'gates').mkdir()
    (logs / 'scored').mkdir()
    for values in itertools.product(*grid):
        r, c, f, p, v = values
        (logs / 'gates/reward.json').write_text(json.dumps({'render': r, 'constraints': c}))
        (logs / 'scored/reward.json').write_text(json.dumps({'functional': f, 'polish': p, 'visual': v}))
        code = module['main'](logs)
        result = json.loads((logs / 'reward.json').read_text())
        rows.append({'inputs': list(values), 'exit': code, 'output': result})
by_inputs = {tuple(r['inputs']): r for r in rows}
edges = 0
inversions = []
for values, row in by_inputs.items():
    for dimension, points in enumerate(grid):
        position = points.index(values[dimension])
        if position + 1 == len(points):
            continue
        improved = list(values)
        improved[dimension] = points[position + 1]
        other = by_inputs[tuple(improved)]
        edges += 1
        if row['output']['reward'] > other['output']['reward']:
            inversions.append({'lower': row, 'higher': other})
criteria = {}
for p in sorted((TASK / 'tests').glob('*/*/judge.toml')):
    data = tomllib.loads(p.read_text())
    criteria[str(p.relative_to(TASK))] = {'aggregation': data['scoring']['aggregation'], 'count': len(data['criterion']), 'weight_sum': sum(c['weight'] for c in data['criterion']), 'nonpositive_weights': [c['id'] for c in data['criterion'] if c['weight'] <= 0]}
result = {'scope': __doc__, 'input_sha256': raw['input_sha256'], 'command': 'python -B qc/runs/hireops-2026-10-01-transaction-hardening-r3/per-row-review/evidence/42/score-probe.py', 'python': sys.version, 'raw_index_sha256': sha(index), 'artifact_hash_count': len(checks), 'artifact_hash_mismatches': [c for c in checks if not c['matches']], 'binding_mismatches': [b for b in bindings if not b['matches']], 'bindings': bindings, 'runtime_evidence_present': (RUN / 'runtime-evidence.json').exists(), 'source_hashes': {'tests/tools/score.py': sha(TASK / 'tests/tools/score.py'), 'tests/scoring.toml': sha(TASK / 'tests/scoring.toml')}, 'criteria': criteria, 'synthetic_cases': len(rows), 'adjacent_improvement_comparisons': edges, 'inversions': inversions, 'cases': rows}
(OUT / 'score-probe.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
(OUT / 'index-hash-checks.json').write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: result[k] for k in ['scope', 'artifact_hash_count', 'artifact_hash_mismatches', 'binding_mismatches', 'runtime_evidence_present', 'synthetic_cases', 'adjacent_improvement_comparisons', 'inversions']}, indent=2))
