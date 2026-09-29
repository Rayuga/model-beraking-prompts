"""Bind the written forward-coverage map to fresh local result files."""
import hashlib
import json
from pathlib import Path
import tomllib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/colderwater-playground-devtools'
mapping = (OUT / 'REQUIREMENT_COVERAGE.md').read_text(encoding='utf-8')
criteria = tomllib.loads((TASK / 'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))['criterion']
paths = [
    'runtime/golden/golden-browser-results.json',
    'runtime/runtime/browser-evidence/runtime-results.json',
    'runtime/library/browser-evidence/library-results.json',
    'runtime/errors/independent-runtime-results.json',
    'runtime/network/network-boundary-results.json',
    'runtime/budget/title-and-shared-budget-results.json',
    'runtime/validation/validation-boundaries-results.json',
    'runtime/supplement/supplement-results.json',
    'actual-mcp-results.json', 'large-controls-mcp-results.json',
    'restart-full/restart-witness-results.json', 'installer/oracle-reinstall-results.json',
]
records = []
for relative in paths:
    path = OUT / relative
    data = json.loads(path.read_text(encoding='utf-8'))
    passed = data.get('passed')
    if passed is None and isinstance(data.get('results'), list):
        passed = all(item.get('result') == 'pass' for item in data['results']) and not data.get('errors')
    records.append({'path': relative, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'reported_passed': passed, 'named_in_map': relative in mapping})
result = {
    'scope': 'Artifact existence/hash and reported-result binding, not a substitute for semantic review of each script/assertion.',
    'passed': all(r['reported_passed'] is True and r['named_in_map'] for r in records)
              and all(c['id'] in mapping for c in criteria),
    'functional_ids_present': len([c for c in criteria if c['id'] in mapping]),
    'functional_total': len(criteria), 'witnesses': records,
    'requirement_map_sha256': hashlib.sha256((OUT / 'REQUIREMENT_COVERAGE.md').read_bytes()).hexdigest(),
    'functional_source_sha256': hashlib.sha256((TASK / 'tests/scored/functional/judge.toml').read_bytes()).hexdigest(),
}
(OUT / 'coverage-artifact-checks.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': result['passed'], 'functional_ids': result['functional_ids_present'],
                  'witness_files': len(records), 'failed_witnesses': [r for r in records if not r['reported_passed'] or not r['named_in_map']]}, indent=2))
raise SystemExit(0 if result['passed'] else 1)
