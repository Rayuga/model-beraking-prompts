from pathlib import Path
import difflib
import hashlib
import json
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[3]
task = root / 'projects/colderwater-playground-devtools'
archive = root / 'deliverables/colderwater-playground-devtools/final-cross-check-2026-09-27/colderwater-playground-devtools.zip'
files = ['environment/instructions/security.md', 'tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md', 'tests/app_context.md']
paths = ['/app.db', '/app.db-wal', '/app.db-shm', '/server.js', '/package.json', '/package-lock.json', '/npm-shrinkwrap.json', '/.git/config', '/.git/HEAD']
with zipfile.ZipFile(archive) as z:
    old = {name: z.read('colderwater-playground-devtools/' + name).decode() for name in files}
new = {name: (task / name).read_text(encoding='utf-8') for name in files}
a = tomllib.loads(old[files[1]])
b = tomllib.loads(new[files[1]])
old_by_id = {c['id']: c for c in a['criterion']}
new_by_id = {c['id']: c for c in b['criterion']}
privacy_id = 'cw_runtime_files_not_publicly_exposed'
assert {k: v for k, v in old_by_id[privacy_id].items() if k != 'description'} == {k: v for k, v in new_by_id[privacy_id].items() if k != 'description'}
assert {k: v for k, v in a.items() if k != 'criterion'} == {k: v for k, v in b.items() if k != 'criterion'}
old_privacy = next(c['description'] for c in a['criterion'] if c['id'] == 'cw_runtime_files_not_publicly_exposed')
new_privacy = next(c['description'] for c in b['criterion'] if c['id'] == 'cw_runtime_files_not_publicly_exposed')
assert all(p in new_privacy for p in paths)
assert all(p not in new[files[0]] for p in paths)
assert 'publicly reserved' not in new_privacy
assert 'no other filenames' not in new_privacy
assert 'Do not read or classify implementation source, package fields, database bytes or probe response bodies' in new_privacy
assert 'An established denial takes precedence' in new_privacy
assert 'A path actually used by the working playground as a browser asset or public product-data endpoint is allowed' in new_privacy
assert 'Attempt every candidate' in new_privacy
assert 'do not prove absence of every possible disclosure route' in new_privacy
for name in files:
    key = name.replace('/', '__')
    (out / ('before__' + key)).write_text(old[name], encoding='utf-8')
    (out / ('after__' + key)).write_text(new[name], encoding='utf-8')
    (out / (key + '.diff')).write_text(''.join(difflib.unified_diff(old[name].splitlines(True), new[name].splitlines(True), fromfile='63a05-baseline/' + name, tofile='revised-workspace/' + name)), encoding='utf-8')
(out / 'before-privacy-descriptor.txt').write_text(old_privacy, encoding='utf-8')
(out / 'after-privacy-descriptor.txt').write_text(new_privacy, encoding='utf-8')
result = {
    'baseline_archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'candidate_paths': paths,
    'functional_count': len(b['criterion']),
    'functional_weight_sum': sum(c['weight'] for c in b['criterion']),
    'privacy_id_name_type_weight_preserved': True,
    'baseline_functional_count': len(a['criterion']),
    'root_concurrent_added_criteria': sorted(new_by_id.keys() - old_by_id.keys()),
    'root_concurrent_removed_criteria': sorted(old_by_id.keys() - new_by_id.keys()),
    'judge_mcp_scoring_config_preserved': True,
    'public_candidate_list_absent': True,
    'source_body_database_download_inspection_ban_preserved': True,
    'observed_public_role_exception_present': True,
    'denial_before_download_precedence_present': True,
    'exhaustive_guarantee_absent': True,
    'privacy_descriptor_sha256': hashlib.sha256(new_privacy.encode()).hexdigest(),
    'after_file_sha256': {name: hashlib.sha256((task / name).read_bytes()).hexdigest() for name in files},
    'all_current_description_deltas': [key for key in old_by_id.keys() & new_by_id.keys() if old_by_id[key]['description'] != new_by_id[key]['description']],
    'scope_note': 'Root may concurrently repair other descriptors; this subtask changed privacy only.',
    'runtime_evidence': 'Delegated to cold_adversarial_harness; not inferred by this static validator.'
}
(out / 'privacy-validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
