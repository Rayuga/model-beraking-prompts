"""Reviewer evidence audit and synthetic scorer arithmetic, not judge output."""
from pathlib import Path
import hashlib
import json
import runpy
import tomllib

root = Path(__file__).resolve().parents[6]
run = root / 'qc/runs/coldwater-2026-10-01-history-hardening-r1'
evidence = Path(__file__).resolve().parent
manifest = json.loads((run / 'manifest.json').read_text())
frozen = root / manifest['cache']
mismatches = []
checks = {}
for group in ('task', 'rules'):
    checks[group] = len(manifest['inputs'][group])
    for relative, expected in manifest['inputs'][group].items():
        actual = hashlib.sha256((frozen / group / relative).read_bytes()).hexdigest()
        if actual != expected:
            mismatches.append(f'{group}/{relative}')
index = json.loads((run / 'raw-evidence-index.json').read_text())
for relative, expected in index['artifacts'].items():
    if hashlib.sha256((root / relative).read_bytes()).hexdigest() != expected:
        mismatches.append(relative)
raw29 = run / 'per-row-review/evidence/29'
other = json.loads((raw29 / 'evidence-manifest.json').read_text())
for relative, expected in other['artifacts'].items():
    if hashlib.sha256((raw29 / relative).read_bytes()).hexdigest() != expected:
        mismatches.append('raw29/' + relative)
assert not mismatches, mismatches
rubric = tomllib.loads((frozen / 'task/tests/scored/functional/judge.toml').read_text())
ids = ['cw_console_level_stream', 'cw_console_history', 'cw_console_clear_control',
       'cw_editor_monospace', 'cw_editor_line_numbers', 'cw_saved_record_fidelity',
       'cw_saved_records_browser_reload', 'cw_origin_boundary_recovery']
cheap = {r['id']: r['weight'] for r in rubric['criterion'] if r['id'] in ids}
total = sum(r['weight'] for r in rubric['criterion'])
functional = sum(cheap.values()) / total
scorer = runpy.run_path(str(frozen / 'task/tests/tools/score.py'))
scenarios = {
    'blank': {'gates': {'render': 0, 'constraints': 0}, 'scored': {'functional': 0, 'polish': 1, 'visual': 1}},
    'client_only': {'gates': {'render': 1, 'constraints': 0}, 'scored': {'functional': 1, 'polish': 1, 'visual': 1}},
    'cheap_without_recovery': {'gates': {'render': 1, 'constraints': 1}, 'scored': {'functional': (sum(cheap.values())-0.15)/total, 'polish': 1, 'visual': 1}},
    'mock_conservative_presentation': {'gates': {'render': 1, 'constraints': 1}, 'scored': {'functional': functional, 'polish': 1/3, 'visual': 0.5}},
    'mock_plausible_presentation': {'gates': {'render': 1, 'constraints': 1}, 'scored': {'functional': functional, 'polish': 0.75, 'visual': 0.75}},
    'mock_presentation_ceiling': {'gates': {'render': 1, 'constraints': 1}, 'scored': {'functional': functional, 'polish': 1, 'visual': 1}},
}
results = {}
for name, supplied in scenarios.items():
    case = evidence / 'synthetic-score-inputs' / name
    for suite, payload in supplied.items():
        (case / suite).mkdir(parents=True, exist_ok=True)
        (case / suite / 'reward.json').write_text(json.dumps(payload))
    exit_code = scorer['main'](case)
    results[name] = {'supplied_dimension_scores': supplied, 'scorer_exit': exit_code, 'arithmetic_result': json.loads((case / 'reward.json').read_text())}
result = {
    'scope': 'Synthetic score inputs from reviewer analysis, never configured judge results. Browser observations are separate.',
    'input_sha256': manifest['input_sha256'], 'verified_frozen_file_counts': checks,
    'raw_index_artifacts_verified': len(index['artifacts']), 'raw29_artifacts_verified': len(other['artifacts']),
    'mismatches': mismatches, 'cheap_rows': cheap, 'cheap_weight': sum(cheap.values()),
    'total_functional_weight': total, 'conditional_functional_score': functional,
    'scenarios': results,
    'limits': ['No provider or configured judge invoked.', 'Mock is a separate reviewer fixture, not a golden mutation.',
               'Scripted probes reproduce observable bars; actual judge grades and full judge duration remain unmeasured.',
               'Presentation scores are explicit assumptions: conservative grants only workspace organisation and visual raw 3; plausible assumes polish 0.75 and visual raw 4. Screenshots were inspected.',
               'Basic current Save update was observed independently; the complete two-editor S23 protocol was not executed and would fail stale-save outcomes.']
}
(evidence / 'arithmetic-and-hashes.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'hash_mismatches': mismatches, 'cheap_weight': sum(cheap.values()), 'total_functional_weight': total, 'functional': functional, 'conditional_rewards': {k:v['arithmetic_result']['reward'] for k,v in results.items()}}, indent=2))
