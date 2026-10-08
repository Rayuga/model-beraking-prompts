"""Read-only source/fixture observations for quality row 52; no runtime probes."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
CACHE = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r3'
TASK = CACHE / 'task'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

manifest = json.loads((RUN / 'manifest.json').read_text(encoding='utf-8-sig'))
index_path = RUN / 'raw-evidence-index.json'
index = json.loads(index_path.read_text(encoding='utf-8-sig'))
files = sorted(path for path in TASK.rglob('*') if path.is_file())
patterns = {
    'credential_signature': r'(?:AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{18,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN[^\n]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,}\.)',
    'author_machine_path': r'(?<![A-Za-z0-9_/])[A-Za-z]:[\\/]|/(?:Users|home)/|/mnt/[a-z]/|\\\\[A-Za-z]',
    'injection_directive': r'(?i)ignore\s+(?:all\s+)?(?:previous|prior|above)|disregard\s+(?:all\s+)?(?:instructions|rules)|system\s*:\s*|assistant\s*:\s*|give.{0,20}(?:full|maximum).{0,10}(?:score|credit)',
    'url': r'https?://[^\s\x22\x27<>`)]+',
    'network_or_dynamic_execution': r'(?i)\b(?:curl|wget|git clone|https?\.get|https?\.request|fetch\(|npm install|pip3? install|importScripts|eval\(|new Function|atob\(|fromCharCode)',
}
matches = {name: [] for name in patterns}
for path in files:
    for line_no, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        for name, pattern in patterns.items():
            found = re.findall(pattern, line)
            if found:
                matches[name].append({'path': path.relative_to(TASK).as_posix(), 'line': line_no, 'matches': found})

raw_checks = []
source_bindings = {}
for entry in index['entries']:
    path = ROOT / entry['path']
    actual = digest(path) if path.is_file() else None
    raw_checks.append({'path': entry['path'], 'expected': entry['sha256'], 'actual': actual, 'matches': actual == entry['sha256']})
    for rel, expected in entry.get('matching_source_files', {}).items():
        source_bindings[(rel, expected)] = {'path': rel, 'expected': expected, 'actual': digest(TASK / rel), 'matches': digest(TASK / rel) == expected}

seed = json.loads((TASK / 'environment/assets/seed_data.json').read_text())
seed_strings = []
def strings(value, path='$'):
    if isinstance(value, dict):
        for key, item in value.items():
            strings(item, path + '.' + key)
    elif isinstance(value, list):
        for i, item in enumerate(value):
            strings(item, f'{path}[{i}]')
    elif isinstance(value, str):
        seed_strings.append({'path': path, 'value': value})
strings(seed)
task_hashes = {path.relative_to(TASK).as_posix(): digest(path) for path in files}
result = {
    'input_sha256': manifest['input_sha256'],
    'scope': 'Ordinary source hygiene and fixture-data review only. Regex observations supplement manual review; absence of a signature alone cannot establish security. No isolation, escape, credential-exposure, Docker, provider, or hosted runtime experiment was performed.',
    'command': 'python -B qc/runs/hireops-2026-10-01-transaction-hardening-r3/per-row-review/evidence/52/source_hygiene.py',
    'task_file_count': len(files),
    'task_sha256': task_hashes,
    'task_matches_frozen_manifest': task_hashes == manifest['inputs']['task'],
    'patterns': patterns,
    'matches': matches,
    'raw_index_sha256': digest(index_path),
    'raw_index_scope': index.get('scope'),
    'raw_index_artifact_count': len(raw_checks),
    'raw_index_hash_failures': [entry for entry in raw_checks if not entry['matches']],
    'raw_index_hash_checks': raw_checks,
    'raw_index_source_bindings': list(source_bindings.values()),
    'canonical_dockerfiles_match': {rel: (TASK / rel).read_bytes() == (CACHE / 'rules/projects/webdev-task-template' / rel).read_bytes() for rel in ['environment/Dockerfile', 'tests/Dockerfile']},
    'seed_copies_byte_identical': (TASK / 'environment/assets/seed_data.json').read_bytes() == (TASK / 'solution/app/src/seed_data.json').read_bytes(),
    'seed_string_fields': seed_strings,
    'seed_email_domains': sorted({user['email'].split('@')[1] for user in seed['users']}),
    'seed_secret_named_keys': [entry['path'] for entry in seed_strings if re.search(r'(?i)(password|secret|token|api.?key)', entry['path'])],
    'runtime_measurements': {'configured_judge': False, 'oracle_score': False, 'target_model_score': False, 'portal_qc': False},
}
output = Path(__file__).with_name('source-hygiene.json')
output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({
    'output': output.relative_to(ROOT).as_posix(),
    'sha256': digest(output),
    'task_file_count': len(files),
    'task_matches_frozen_manifest': result['task_matches_frozen_manifest'],
    'signature_match_counts': {name: len(values) for name, values in matches.items()},
    'raw_index_artifact_count': len(raw_checks),
    'raw_index_hash_failure_count': len(result['raw_index_hash_failures']),
    'source_binding_failure_count': sum(not value['matches'] for value in source_bindings.values()),
    'canonical_dockerfiles_match': result['canonical_dockerfiles_match'],
    'seed_copies_byte_identical': result['seed_copies_byte_identical'],
    'seed_email_domains': result['seed_email_domains'],
    'seed_secret_named_keys': result['seed_secret_named_keys'],
}, indent=2))
