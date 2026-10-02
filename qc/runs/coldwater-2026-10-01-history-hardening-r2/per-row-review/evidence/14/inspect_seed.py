import csv
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[6]
RUN = ROOT / 'qc/runs/coldwater-2026-10-01-history-hardening-r2'
CACHE = ROOT / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
OUT = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding='utf-8')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = json.loads((RUN / 'manifest.json').read_text(encoding='utf-8'))
results = {'input_sha256': manifest['input_sha256'], 'kind': 'row-14 source and parse evidence only'}
binding = []
for kind in ('task', 'rules'):
    for rel, expected in manifest['inputs'][kind].items():
        file = CACHE / kind / rel
        assert sha(file) == expected, file
        binding.append(str(file.relative_to(ROOT)))
for rel in ('qc/README.md', 'qc/REVIEW_POLICY.md'):
    assert sha(ROOT / rel) == manifest['engine_inputs'][rel], rel
results['binding'] = {'frozen_files_verified': len(binding), 'policy_hash_verified': True}

def strict_object(pairs):
    result = {}
    for key, value in pairs:
        assert key not in result, f'duplicate JSON key {key}'
        result[key] = value
    return result

parsed = {}
for file in sorted((CACHE / 'task').rglob('*')):
    if file.is_file() and file.suffix.lower() in ('.json', '.csv', '.tsv'):
        if file.suffix.lower() == '.json':
            value = json.loads(file.read_text(encoding='utf-8'), object_pairs_hook=strict_object)
        else:
            value = list(csv.reader(file.open(encoding='utf-8', newline=''), delimiter='\t' if file.suffix == '.tsv' else ','))
        parsed[file.relative_to(CACHE / 'task').as_posix()] = value
results['structured_files'] = [{'path': rel, 'sha256': sha(CACHE / 'task' / rel), 'parses': True} for rel in parsed]
seed = parsed['environment/assets/seed_data.json']
assert seed == {'snippets': [], 'note': 'No saved snippets are supplied in this seed. Build a JavaScript and HTML playground with durable revision history.'}
results['seed'] = {'content': seed, 'saved_records': 0, 'referenced_ids': [], 'orphan_rows': [], 'people_or_organisations': [], 'credentials': [], 'review': 'Only free text is product-scope prose; no instruction to a grader, script payload, PII, credential, or external URL.'}

lock = parsed['solution/app/package-lock.json']
package = parsed['solution/app/package.json']
for key in ('name', 'version', 'dependencies', 'devDependencies', 'engines'):
    assert lock['packages'][''][key] == package[key]
for category in ('dependencies', 'devDependencies'):
    for name, version in package[category].items():
        assert lock['packages']['node_modules/' + name]['version'] == version
urls = []
text_signals = []
def walk(value, path):
    if isinstance(value, dict):
        for k, v in value.items():
            walk(v, path + '/' + k)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            walk(v, path + '/' + str(i))
    elif isinstance(value, str):
        if value.startswith(('https://', 'http://')):
            u = urlsplit(value)
            assert not u.username and not u.password, path
            urls.append(u.hostname)
        if re.search(r'ignore (all|previous)|system prompt|BEGIN.*PRIVATE KEY|sk-[A-Za-z0-9]{20}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', value, re.I):
            text_signals.append(path)
for rel, value in parsed.items():
    walk(value, rel)
results['metadata'] = {'package_lock_entries': len(lock['packages']), 'declared_dependency_versions_match_lock': True, 'url_hosts': sorted(set(urls)), 'credential_urls': [], 'email_or_injection_scan_paths': text_signals}
index_path = RUN / 'raw-evidence-index.json'
index = json.loads(index_path.read_text(encoding='utf-8'))
assert index['input_sha256'] == manifest['input_sha256']
for rel, expected in index['artifacts'].items():
    assert sha(ROOT / rel) == expected, rel
results['raw_index'] = {'sha256': sha(index_path), 'artifact_hashes_verified': len(index['artifacts']), 'used_for_runtime_claim': False}
listing = subprocess.run([sys.executable, '-B', str(CACHE / 'rules/harbor-webdev-rubric-qc/scripts/list_checks.py'), '--workbook', str(CACHE / 'rules/WebDev Rubrics QC.xlsx'), '--json'], check=True, stdout=subprocess.PIPE)
(OUT / 'workbook-enumeration.json').write_bytes(listing.stdout)
(OUT / 'seed-inspection.json').write_text(json.dumps(results, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps(results, indent=2, ensure_ascii=False))
