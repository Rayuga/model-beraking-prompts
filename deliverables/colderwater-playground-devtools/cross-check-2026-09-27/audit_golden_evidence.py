from pathlib import Path
import hashlib, json, tomllib

out = Path(__file__).resolve().parent
previous = out.parent / 'full-qc-2026-09-27'
task = out / 'golden-extracted/colderwater-playground-devtools'
mapping = json.loads((previous / 'GOLDEN_CRITERION_EVIDENCE.json').read_text(encoding='utf-8'))
observed = []
for area, dimension in [('gates', 'render'), ('gates', 'constraints'), ('scored', 'functional'), ('scored', 'polish'), ('scored', 'visual')]:
    path = task / f'tests/{area}/{dimension}/judge.toml'
    assert hashlib.sha256(path.read_bytes()).hexdigest() == mapping['rubric_sha256'][path.relative_to(task).as_posix()]
    for criterion in tomllib.loads(path.read_text(encoding='utf-8'))['criterion']:
        observed.append((f'{area}/{dimension}', criterion['id'], criterion['type'], criterion['weight']))
expected = [(row['dimension'], row['id'], row['type'], row['weight']) for row in mapping['criteria']]
assert observed == expected
assert len(observed) == 45
assert sum(x[3] for x in observed if x[0] == 'scored/functional') == 49.5
files = sorted({path for row in mapping['criteria'] for path in row['evidence']})
results = []
for relative in files:
    path = previous / relative
    assert path.is_file(), relative
    if path.suffix != '.json':
        continue
    data = json.loads(path.read_text(encoding='utf-8'))
    assert not data.get('error'), (relative, data.get('error'))
    if 'passed' in data:
        assert data['passed'] is True, relative
    for key in ['errors', 'browser_errors', 'pageErrors']:
        if key in data:
            assert data[key] == [], (relative, key)
    for key in ['checks', 'results', 'criteria']:
        if isinstance(data.get(key), list):
            for item in data[key]:
                if isinstance(item, dict):
                    if 'passed' in item:
                        assert item['passed'] is True, (relative, item)
                    if 'result' in item:
                        assert item['result'] == 'pass', (relative, item)
    results.append({'path': relative, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'no_recorded_failure': True})
fresh = json.loads((out / 'golden-flow-results.json').read_text(encoding='utf-8'))
assert fresh['passed'] and len(fresh['checks']) == 6 and not fresh['pageErrors']
report = {'scope': 'Evidence identity and recorded-results integrity; semantic witness-leg review is in GOLDEN_RECHECK.md', 'criterion_count': len(observed), 'functional_count': sum(x[0] == 'scored/functional' for x in observed), 'functional_weight': 49.5, 'prior_rubric_digests_match_final_archive': True, 'reused_json_results': results, 'fresh_flow_checks': 6, 'passed': True}
(out / 'golden-evidence-integrity.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'criteria': len(observed), 'reused_json_files': len(results), 'fresh_flow_checks': 6}))
