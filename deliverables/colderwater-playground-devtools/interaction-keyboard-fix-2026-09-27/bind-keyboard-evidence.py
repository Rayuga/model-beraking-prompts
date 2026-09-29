from pathlib import Path
import hashlib
import json
import tomllib

root = Path('projects/colderwater-playground-devtools')
out = Path('deliverables/colderwater-playground-devtools/interaction-keyboard-fix-2026-09-27')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
baseline = json.loads((out / 'keyboard-baseline-hashes.json').read_text(encoding='utf-8'))
current = {p.relative_to(root).as_posix(): sha(p) for p in (root / 'solution').rglob('*') if p.is_file()}
old = {k: v for k, v in baseline.items() if k.startswith('solution/')}
delta = {k: {'before': old.get(k), 'after': current.get(k)} for k in sorted(old.keys() | current.keys()) if old.get(k) != current.get(k)}
assert set(delta) == {'solution/app/src/app.tsx', 'solution/app/public/index.html', 'solution/app/public/assets/index-BEJFu1NO.js', 'solution/app/public/assets/index-XwoWsDAE.js'}
build = json.loads((out / 'keyboard-built-inputs.json').read_text(encoding='utf-8'))
assert build['vite'] == '7.1.7' and build['typescript'] == '5.9.2'
for rel, digest in build['inputsAndOutputs'].items():
    assert sha(root / 'solution/app' / rel) == digest, rel
proof = json.loads((out / 'keyboard-proof-results.json').read_text(encoding='utf-8'))
assert proof['passed'] and len(proof['checks']) == 5 and all(x['passed'] for x in proof['checks'])
for url, digest in proof['checks'][0]['hashes'].items():
    assert sha(root / 'solution/app/public' / url.lstrip('/')) == digest
polish = tomllib.loads((root / 'tests/scored/polish/judge.toml').read_text(encoding='utf-8'))
functional = tomllib.loads((root / 'tests/scored/functional/judge.toml').read_text(encoding='utf-8'))
assert len(polish['criterion']) == 4 and sum(x['weight'] for x in polish['criterion']) == 4
assert len(functional['criterion']) == 33 and sum(x['weight'] for x in functional['criterion']) == 49.5
report = {
    'passed': True,
    'solution_delta': delta,
    'solution_unchanged_paths': sorted(k for k in old.keys() & current.keys() if old[k] == current[k]),
    'current_solution_hashes': current,
    'build_inputs_and_outputs_match_task': True,
    'served_assets_match_build_and_task': True,
    'polish_count': 4, 'polish_weight': 4,
    'functional_count': 33, 'functional_weight': 49.5,
    'proof_result_sha256': sha(out / 'keyboard-proof-results.json'),
    'proof_script_sha256': sha(out / 'keyboard-proof.cjs'),
    'scope': 'Fresh keyboard/help/readiness proof on current golden; prior runtime/server/CSS/installer evidence may be reused only under these unchanged file hashes. No hosted Oracle or LLM judge run.'
}
(out / 'keyboard-evidence-binding.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['passed', 'solution_delta', 'polish_count', 'polish_weight', 'functional_count', 'functional_weight']}, indent=2))
