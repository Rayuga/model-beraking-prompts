"""Validate exact-current scripted browser proof before the independent QC round."""
from pathlib import Path
import hashlib
import json
import re

root = Path.cwd()
here = Path(__file__).resolve().parent
task = root/'projects/colderwater-playground-devtools'
inputs = json.loads((here/'proof-inputs.json').read_text(encoding='utf-8'))
assert inputs['freeze_confirmed'] is True
actual_hashes = {
    f.relative_to(task).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest()
    for f in task.rglob('*') if f.is_file()
}
assert actual_hashes == inputs['source_hashes'], 'Candidate bytes changed after fixture binding'

facts = {}
phases = {}
for phase in ('runtime', 'history', 'post'):
    report = json.loads((here/f'{phase}-results.json').read_text(encoding='utf-8'))
    assert report['all_observations_passed'], (phase, report.get('fatal'))
    assert all(row['status'] == 'observed pass' for row in report['observations'])
    facts.update(report['facts'])
    phases[phase] = {'observations': len(report['observations']), 'wall_ms': report['wall_ms']}

coverage = []
for criterion in inputs['criteria']:
    match = re.match(r'(S\d+\.[a-z0-9_]+):', criterion['description'])
    assert match, criterion['id']
    key = match.group(1)
    coverage.append({'id': criterion['id'], 'key': key, 'passed': facts.get(key, {}).get('passed', False)})
assert len(coverage) == 82
assert all(row['passed'] for row in coverage), [row for row in coverage if not row['passed']]
(here/'functional-coverage.json').write_text(json.dumps(coverage, indent=2)+'\n', encoding='utf-8')

surface = json.loads((here/'surface-results.json').read_text(encoding='utf-8'))
assert surface['passed'] and not surface['visual_grade_measured']
assert all(row['pass'] for row in surface['checks'].values())
canvas = json.loads((here/'canvas-regression.json').read_text(encoding='utf-8'))
assert canvas['passed'] and len(canvas['cases']) == 3
binding = json.loads((here/'full-install-binding.json').read_text(encoding='utf-8'))
assert binding['passed'] and binding['container'] == 'cw-history-r3b-golden'
regressions = json.loads((here/'golden-regressions.json').read_text(encoding='utf-8'))
assert regressions['passed']
guards = json.loads((here/'source-guards.json').read_text(encoding='utf-8'))
preflight = json.loads((here/'preflight.json').read_text(encoding='utf-8'))
assert guards['passed'] and preflight['passed']

summary = {
    'scope': 'Exact-current full-install scripted golden evidence; not configured Oracle, Luna, visual Likert or portal QC grades',
    'task_file_count': len(actual_hashes),
    'functional_criteria': len(coverage),
    'functional_weight': sum(row['weight'] for row in inputs['criteria']),
    'phases': phases,
    'gate_checks': ['render', 'constraints'],
    'polish_checks': [key for key in surface['checks'] if key not in ('render', 'constraints')],
    'canvas_cases': [row['ending'] for row in canvas['cases']],
    'focused_regressions': [row['id'] for row in regressions['observations']],
    'exact_install_files': len(binding['expected_solution_hashes']),
    'scripted_passed': True,
    'limits': [
        'No exact-current configured Oracle or target Luna score was measured.',
        'No configured judge elapsed duration or visual Likert grade was measured.',
        'The shared prompt argv/proc exposure and deferred shared restart issue are not cured by task-specific changes.',
        'Earlier fixture and reused-database failures are retained in attempt1 and attempt2, not counted as passes.',
    ],
}
(here/'local-proof-summary.json').write_text(json.dumps(summary, indent=2)+'\n', encoding='utf-8')
print(json.dumps(summary))
