"""Synthetic scorer arithmetic only; no app, configured judge, or provider run."""
from pathlib import Path
import hashlib
import json
import runpy
import tempfile
import tomllib

root = Path.cwd()
frozen = root / '.qc-cache/hireops-2026-10-01-transaction-hardening-r2'
task = frozen / 'task'
criteria = tomllib.loads((task / 'tests/scored/functional/judge.toml').read_text())['criterion']
total = sum(c['weight'] for c in criteria)
batch = sum(c['weight'] for c in criteria if c['id'].startswith('hro_change_'))
index_path = root / 'qc/runs/hireops-2026-10-01-transaction-hardening-r2/raw-evidence-index.json'
index = json.loads(index_path.read_text(encoding='utf-8'))
errors = []
for entry in index['entries']:
    artifact = root / entry['path']
    actual = hashlib.sha256(artifact.read_bytes()).hexdigest() if artifact.exists() else None
    if actual != entry['sha256']:
        errors.append({'path': entry['path'], 'actual': actual, 'expected': entry['sha256']})

result = {
    'scope': __doc__,
    'input_sha256': index['input_sha256'],
    'raw_index_sha256_at_read': hashlib.sha256(index_path.read_bytes()).hexdigest(),
    'raw_index_entries_checked': len(index['entries']),
    'raw_index_hash_errors': errors,
    'functional_count': len(criteria),
    'functional_total_weight': total,
    'coordinated_weight': batch,
    'other_functional_weight': total - batch,
    'coordinated_global_contribution': .6 * batch / total,
    'other_functional_global_contribution': .6 * (total - batch) / total,
    'source_hashes': {},
    'template_matches': {},
    'cases': [],
}
for relative in ('tests/scoring.toml', 'tests/tools/score.py', 'tests/scored/functional/judge.toml', 'tests/scored/polish/judge.toml', 'tests/scored/visual/judge.toml'):
    result['source_hashes'][relative] = hashlib.sha256((task / relative).read_bytes()).hexdigest()
for relative in ('tests/scoring.toml', 'tests/tools/score.py'):
    result['template_matches'][relative] = (task / relative).read_bytes() == (frozen / 'rules/projects/webdev-task-template' / relative).read_bytes()

main = runpy.run_path(str(task / 'tests/tools/score.py'), run_name='row44_weight_probe')['main']
cases = [
    ('gate_failed_even_with_maximum_scored_inputs', 0, 1, 1, 1),
    ('requisition_credit_only_generously_granted_maximum_polish_visual', 1, .01 / total, 1, 1),
    ('zero_functional_maximum_polish_visual', 1, 0, 1, 1),
    ('all_functional_and_recovery_minimum_visual', 1, 1, 1, 0),
    ('ordinary_only_upper_bound_maximum_visual', 1, (total - batch) / total, 3 / 9, 1),
    ('maximum_all_inputs', 1, 1, 1, 1),
]
for name, gate, functional, polish, visual in cases:
    with tempfile.TemporaryDirectory(prefix='hireops-row44-') as temporary:
        destination = Path(temporary)
        (destination / 'gates').mkdir()
        (destination / 'scored').mkdir()
        (destination / 'gates/reward.json').write_text(json.dumps({'render': gate, 'constraints': gate}))
        scores = {'functional': functional, 'polish': polish, 'visual': visual}
        (destination / 'scored/reward.json').write_text(json.dumps(scores))
        exit_code = main(destination)
        result['cases'].append({'name': name, 'synthetic_inputs': scores, 'gate_input': gate, 'exit_code': exit_code, 'scorer_output': json.loads((destination / 'reward.json').read_text())})

output = Path(__file__).with_name('weight-probe.json')
if output.exists():
    raise RuntimeError('Preserve existing evidence')
output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'output': str(output), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'raw_hash_errors': errors, 'cases': {c['name']: c['scorer_output']['reward'] for c in result['cases']}}, indent=2))
