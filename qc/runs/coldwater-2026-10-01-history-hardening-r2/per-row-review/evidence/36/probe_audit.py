"""Read-only row 36 source audit; not the private checker or configured judge."""
from pathlib import Path
import hashlib
import json
import re
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/coldwater-2026-10-01-history-hardening-r2'
BASE = ROOT / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
OUT = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))
bindings = []
for kind in ('task', 'rules'):
    for name, expected in manifest['inputs'][kind].items():
        path = BASE / kind / name
        actual = sha(path)
        bindings.append({'path': path.relative_to(ROOT).as_posix(), 'expected': expected,
                         'actual': actual, 'matches': actual == expected})
policy = ROOT / 'qc/REVIEW_POLICY.md'
bindings.append({'path': 'qc/REVIEW_POLICY.md', 'expected': manifest['engine_inputs']['qc/REVIEW_POLICY.md'],
                 'actual': sha(policy), 'matches': sha(policy) == manifest['engine_inputs']['qc/REVIEW_POLICY.md']})
index_path = RUN / 'raw-evidence-index.json'
index = json.loads(index_path.read_text(encoding='utf-8'))
raw_hashes = []
for name, expected in index['artifacts'].items():
    path = ROOT / name
    actual = sha(path) if path.exists() else None
    raw_hashes.append({'path': name, 'expected': expected, 'actual': actual, 'matches': actual == expected})

task = BASE / 'task'
probe_files = sorted(p for p in (task / 'tests').rglob('*') if p.is_file() and p.suffix in ('.md', '.toml'))
probe_text = '\n'.join(p.read_text(encoding='utf-8') for p in probe_files)
candidate_tokens = set(re.findall(r'\b[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)+\b', probe_text))
explicit_values = [
    'CW gate ', 'QC Save Alpha', 'QC Save Beta', 'QC Restart Primary',
    'QC Concurrent Save', 'QC Concurrent Save Draft', 'QC Concurrent Save Updated',
    'QC Reverse Draft', 'QC Reverse Winner', 'QC Version Sketch', 'QC Version Sketch B',
    'QC Version Sketch C', 'QC History Unsaved', 'forEeach', 'undefinedFunctionCall',
    'Failed HTML candidate', 'Try later action', 'Later interaction input', 'Commit picture',
    'Fail later action', 'Preview note', 'Paint picture', '__cancelLeak',
    'unsupported-import-executed', 'EXTERNAL_FETCH_LOADED', 'EXTERNAL_IMAGE_LOADED',
    'qc-alpha.js', 'qc-beta.html', 'restart.js', 'qc-concurrent.js', 'qc-concurrent-draft.js',
    'qc-concurrent.html', 'qc-reverse-draft.js', 'qc-reverse-winner.html',
    'version-a.js', 'version-b.html', 'version-c.js', 'history-unsaved.js',
    'history-after-restore.js', 'dispatch.js', 'dispatch.html', 'interaction.html',
    'interaction.js', 'recovery.js', 'replacement.html', 'scope-control.html',
    'bad.js', 'bad.html', 'delayed-error.js', 'delayed-error.html',
    'rejected-promise.js', 'plain-rejection.js', 'html-rejection.html', 'duration.js',
]
initial_files = [task / 'environment/assets/seed_data.json'] + sorted(p for p in (task / 'solution').rglob('*') if p.is_file())
initial_text = {p.relative_to(task).as_posix(): p.read_text(encoding='utf-8', errors='replace') for p in initial_files}
def matches(value):
    return [name for name, content in initial_text.items() if value in content]
generic_hits = {
    'Auto-run': 'Required UI control label, not a distinctive authored mutation result.',
    'Cache-Control': 'HTTP header, not a mutation probe.',
    'aria-label': 'Markup attribute, not the authored value of the probe.',
    'content-type': 'HTTP/MIME implementation term, not a mutation probe.',
    'five-second': 'Required timing-policy wording, not an authored mutation value.',
    'font-size': 'CSS property, not a mutation probe.',
    'letter-spacing': 'CSS property, not a mutation probe.',
    'no-op': 'Generic vendor/comment terminology, not a mutation probe.',
    'no-store': 'HTTP cache directive, not a mutation probe.',
    'read-only': 'Generic vendor terminology, not a mutation probe.',
    'same-origin': 'Generic browser policy term, not a mutation probe.',
    'text-only': 'Generic vendor terminology, not a mutation probe.',
}
token_results = [{'value': value, 'matches': matches(value),
                  'nonprobe_classification': generic_hits.get(value)} for value in sorted(candidate_tokens)]
explicit_results = [{'value': value, 'matches': matches(value)} for value in explicit_values]
unexplained_hits = [item for item in token_results if item['matches'] and not item['nonprobe_classification']]
explicit_hits = [item for item in explicit_results if item['matches']]

workbook = load_workbook(BASE / 'rules/WebDev Rubrics QC.xlsx', data_only=False)
workbook_rows = {}
for sheet_name, row_number in [('Quality Checks', 37), ('Internal Quality Checks', 37), ('Deterministic Checks', 24)]:
    workbook_rows[sheet_name] = [{'cell': c.coordinate, 'value': c.value,
                                  'comment': c.comment.text if c.comment else None}
                                 for c in workbook[sheet_name][row_number] if c.value is not None or c.comment]
result = {
    'scope': 'Quality row 36 only: source inspection and literal comparison; no private deterministic suite, browser runtime, configured judge or grade measured.',
    'input_sha256': manifest['input_sha256'],
    'script_sha256': sha(Path(__file__)),
    'frozen_bindings': bindings,
    'raw_evidence_index': {'sha256': sha(index_path), 'input_matches': index['input_sha256'] == manifest['input_sha256'],
                           'artifact_hashes': raw_hashes, 'observations_relied_on': []},
    'workbook_rows': workbook_rows,
    'probe_files': {p.relative_to(task).as_posix(): sha(p) for p in probe_files},
    'scanned_initial_files': {p.relative_to(task).as_posix(): sha(p) for p in initial_files},
    'seed': json.loads((task / 'environment/assets/seed_data.json').read_text(encoding='utf-8')),
    'token_results': token_results,
    'explicit_results': explicit_results,
    'unexplained_hits': unexplained_hits,
    'explicit_hits': explicit_hits,
    'adversarial_analysis': {
        'broken_app': 'A seed-copy UI with dead Save/Run cannot obtain the required probe results from these inputs: seed is empty, the initial editor/console are empty, and the placeholder preview contains no probe. Render also chooses fresh marker and operands with a computed result absent from literal source; Constraints chooses a new unique gate title and requires independent-context readback of the actual saved identity. This is a source-level challenge, not an executed weak-app grade.',
        'conforming_alternative': 'A working implementation starting with an empty library, blank editor, or its own harmless example is not rejected for lacking the QC titles. S21 explicitly creates New/Save Alpha and Beta; S37 explicitly creates history versions; Render and Constraints author their own controls. No pre-existing probe is required. Ordinary CSS/HTTP/UI terms may exist without pre-satisfying authored output.',
    },
}
(OUT / 'probe-audit.json').write_text(json.dumps(result, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
assert all(item['matches'] for item in bindings), 'Frozen input hash mismatch'
assert all(item['matches'] for item in raw_hashes), 'Raw index artifact hash mismatch'
assert not unexplained_hits and not explicit_hits, 'Distinctive probe found in initial source'
print(json.dumps({'frozen_bindings_checked': len(bindings), 'raw_artifact_hashes_checked': len(raw_hashes),
                  'initial_files_scanned': len(initial_files), 'broad_tokens_checked': len(token_results),
                  'generic_nonprobe_hits': len([x for x in token_results if x['matches']]),
                  'explicit_values_checked': len(explicit_results), 'distinctive_hits': 0,
                  'evidence_sha256': sha(OUT / 'probe-audit.json')}))
