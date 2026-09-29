"""Execute the shipped scorer with synthetic inputs, never a judge score."""
from pathlib import Path
import hashlib
import importlib.util
import json
import sys

sys.dont_write_bytecode = True
out = Path(__file__).resolve().parent
root = out.parents[2]
source = root / 'projects/ridgeline-print-storefront/tests/tools/score.py'
spec = importlib.util.spec_from_file_location('score_under_test', source)
scorer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scorer)
results = []


def exercise(name, gates, scored, expected=None, error=False, code=0):
    case = out / 'scoring-fixtures' / name
    case.mkdir(parents=True, exist_ok=True)
    for label, values in [('gates', gates), ('scored', scored)]:
        if values is not None:
            (case / label).mkdir(exist_ok=True)
            (case / label / 'reward.json').write_text(json.dumps(values), encoding='utf-8')
    try:
        status = scorer.main(case)
    except ValueError as exc:
        assert error, (name, str(exc))
        results.append({'name': name, 'passed': True, 'rejected': str(exc)})
    else:
        assert not error, name
        result = json.loads((case / 'reward.json').read_text(encoding='utf-8'))
        assert result['reward'] == expected, (name, result, expected)
        assert status == code, (name, status, code)
        assert float((case / 'reward.txt').read_text()) == expected
        ctrf = json.loads((case / 'ctrf.json').read_text())
        assert ctrf['summary']['total'] == 6
        results.append({'name': name, 'passed': True, 'reward': result['reward'], 'exit_code': status})


gate_pass = {'render': 1, 'constraints': 1}
full = {'functional': 1, 'polish': 1, 'visual': 1}
exercise('all_full_synthetic', gate_pass, full, 1)
exercise('render_failure', {'render': 0, 'constraints': 1}, full, 0, code=1)
exercise('constraints_failure', {'render': 1, 'constraints': 0}, full, 0, code=1)
exercise('both_gates_failed_no_scored', {'render': 0, 'constraints': 0}, None, 0, code=1)
exercise('missing_scored', gate_pass, None, 0)
exercise('zero_functional', gate_pass, {**full, 'functional': 0}, 0)
exercise('exact_floor', gate_pass, {**full, 'functional': .05}, 0)
exercise('just_above_floor', gate_pass, {**full, 'functional': .05001}, .43)
exercise('functional_half_full_presentation', gate_pass, {**full, 'functional': .5}, .7)
exercise('half_all_dimensions', gate_pass, dict.fromkeys(full, .5), .5)
exercise('functional_only', gate_pass, {'functional': 1, 'polish': 0, 'visual': 0}, .6)
exercise('missing_gate_file', None, full, error=True)
exercise('missing_gate_key', {'render': 1}, full, error=True)
exercise('missing_dimension', gate_pass, {'functional': 1, 'polish': 1}, error=True)
for label, value in [('boolean', True), ('string', '1'), ('negative', -.1), ('above_one', 1.1), ('nan', float('nan')), ('infinite', float('inf'))]:
    exercise('invalid_' + label, gate_pass, {**full, 'functional': value}, error=True)
report = {'scope': 'Executed current canonical score.py using synthetic dimension inputs; this is neither Oracle nor model grading.',
          'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'passed': len(results), 'failed': 0, 'results': results}
(out / 'scoring-results.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['scope', 'passed', 'failed']}))
