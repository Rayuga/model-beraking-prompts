import hashlib
import json
import re
import tomllib
import zipfile
from pathlib import Path

out = Path(__file__).resolve().parent
task = out.parents[2] / 'projects/common-ground-ballot'
previous = out.parent / '2026-09-12-standard-r1'
sha = lambda value: hashlib.sha256(value).hexdigest()

def read(name):
    return json.loads((out / name).read_text())

def write(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n')

files = {p.relative_to(task).as_posix(): p.read_bytes()
         for p in sorted(task.rglob('*')) if p.is_file()}
prefix = 'common-ground-ballot/'
old_zip = previous / 'common-ground-ballot.zip'
with zipfile.ZipFile(old_zip) as z:
    assert all(n.startswith(prefix) for n in z.namelist())
    before = {n[len(prefix):]: z.read(n) for n in z.namelist()}
assert set(files) == set(before) and len(files) == 36
changed = [n for n in files if files[n] != before[n]]
assert set(changed) == {'tests/functional/judge.toml', 'tests/functional/prompt.md'}, changed
for name, contents in files.items():
    assert name.split('/')[0] in {'README.md','environment','instruction.md','rubrics','solution','task.toml','tests'}
    assert not set(Path(name).parts) & {'.git','node_modules','__pycache__','reports','jobs'}
    assert not name.endswith(('.db','.sqlite','.pyc','.zip'))
    assert not re.search(rb'sk-(?:or-v1-|proj-)[A-Za-z0-9_-]{16,}', contents)
    if name.endswith(('.sh','.py')):
        assert b'\r\n' not in contents, name
key = 'tests/functional/judge.toml'
old_judge = tomllib.loads(before[key].decode())
new_judge = tomllib.loads(files[key].decode())
old_description = next(c['description'] for c in old_judge['criterion'] if c['id'] == 'published_approval_tally')
new_description = next(c['description'] for c in new_judge['criterion'] if c['id'] == 'published_approval_tally')
assert 'and an explanation that approval percentages may exceed 100% in total' in old_description
assert 'Do not require a separate explanatory sentence about the percentage total.' in new_description
expected = old_description.replace(
    'Bike racks 1 and 50%, Community noticeboard 1 and 50%, and an explanation that approval percentages may exceed 100% in total.',
    'Bike racks 1 and 50%, and Community noticeboard 1 and 50%. Do not require a separate explanatory sentence about the percentage total.')
assert new_description == expected
for criterion in old_judge['criterion']:
    if criterion['id'] == 'published_approval_tally':
        criterion['description'] = new_description
assert new_judge == old_judge
prompt = 'tests/functional/prompt.md'
assert files[prompt] == before[prompt].replace(b'functional-v1.0.0-r3', b'functional-v1.0.0-r4')

counts = {}
provenance = read('prompt-provenance.json')
for dimension in ('render','constraints','functional','polish','visual'):
    prompt = f'tests/{dimension}/prompt.md'
    judge = f'tests/{dimension}/judge.toml'
    counts[dimension] = len(tomllib.loads(files[judge].decode())['criterion'])
    assert provenance['judges'][dimension]['prompt_sha256'] == sha(files[prompt])
    assert provenance['judges'][dimension]['judge_sha256'] == sha(files[judge])
assert sum(counts.values()) == 33
assert provenance['runner_sha256'] == sha(files['tests/test.sh'])
assert provenance['reward_sha256'] == sha(files['tests/reward.toml'])
assert read('standard-checks.json')['passed']
for name in ('runtime-results.json','browser-results.json','harness-results.json'):
    assert all(r['passed'] for r in read(name)['results']), name
assert not read('browser-results.json')['errors']
assert all(r['exit_code'] == 0 for r in read('validation.json')['builds'])
assert all(r['exit_code'] == 0 for r in read('validation.json')['local_runs'])

coverage = json.loads((previous / 'coverage.json').read_text())
all_ids = {c['id'] for d in counts for c in tomllib.loads(files[f'tests/{d}/judge.toml'].decode())['criterion']}
assert {c for group in coverage['requirements'] for c in group['criteria']} == all_ids
write('coverage.json', coverage)
write('before-after.json', {
    'previous_zip_sha256': sha(old_zip.read_bytes()), 'changed_task_files': changed,
    'criterion_id': 'published_approval_tally', 'before': old_description, 'after': new_description,
    'all_other_criteria_and_weights_unchanged': True,
    'golden_solution_instructions_seeds_runtime_unchanged': True,
    'prompt_version': provenance['judges']['functional']['prompt_version']})
archive = out / 'common-ground-ballot.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, contents in files.items():
        info = zipfile.ZipInfo(prefix + name, (2026,9,12,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        z.writestr(info, contents)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist()) == len(files)
    for name, contents in files.items():
        assert z.read(prefix + name) == contents
write('source-hashes.json', {name: sha(contents) for name, contents in files.items()})
digest = sha(archive.read_bytes())
(out / 'SHA256SUMS.txt').write_text(digest + '  ' + archive.name + '\n')
write('package-audit.json', {'passed': True, 'files': len(files), 'criteria': counts,
    'zip_sha256': digest, 'only_expected_two_files_changed': True,
    'root_allowlist_passed': True, 'runtime_provenance_matches_zip': True,
    'fresh_oracle_run': False, 'fresh_platform_qc_run': False,
    'previous_platform_results_user_screenshot': {'static': '45/45', 'rubric_source': '52/53'}})
print('PASS corrected package: 36 files, 33 criteria; SHA256 ' + digest)
