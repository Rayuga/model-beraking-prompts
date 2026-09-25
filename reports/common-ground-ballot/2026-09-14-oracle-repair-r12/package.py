import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
TASK = ROOT / 'projects/common-ground-ballot'
DELIVERY = ROOT / 'deliverables/common-ground-ballot/2026-09-14-oracle-repair-r12'
BASE = ROOT / 'deliverables/common-ground-ballot/2026-09-14-functional-r11/common-ground-ballot.zip'
DIMS = ['render', 'constraints', 'functional', 'polish', 'visual']
sha = lambda data: hashlib.sha256(data).hexdigest()


def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in sorted(TASK.rglob('*')) if p.is_file()}
with zipfile.ZipFile(BASE) as archive:
    previous = {name.removeprefix('common-ground-ballot/'): archive.read(name) for name in archive.namelist() if not name.endswith('/')}
assert set(files) == set(previous)
changed = [name for name, data in files.items() if data != previous[name]]
assert set(changed) == {'solution/public/app.js', 'tests/functional/prompt.md'}
for dim in DIMS:
    assert files[f'tests/{dim}/judge.toml'] == previous[f'tests/{dim}/judge.toml']
criteria = tomllib.loads(files['tests/functional/judge.toml'].decode())['criterion']
assert len(criteria) == 22 and sum(c['weight'] for c in criteria) == 34
counts = {'browser': 45, 'runtime': 5, 'harness': 15, 'session': 7}
for mode, count in counts.items():
    result = json.loads((OUT / ('validation-' + mode) / (mode + '-results.json')).read_text(encoding='utf-8'))
    assert len(result['results']) == count and all(row['passed'] for row in result['results']), mode
    if mode == 'browser': assert result['errors'] == []
baseline = json.loads((OUT / 'session-baseline/session-results.json').read_text(encoding='utf-8'))
assert len(baseline['results']) == 7
assert [r['passed'] for r in baseline['results']] == [True] * 5 + [False, False]
spec = importlib.util.spec_from_file_location('standard', ROOT / 'references/task-templates/check-standard.py')
standard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(standard)
standard_checks = standard.validate(TASK)
write('standard-checks.json', standard_checks)
provenance = json.loads((OUT / 'validation-harness/prompt-provenance.json').read_text(encoding='utf-8'))
for dimension in DIMS:
    for key, name in [('prompt_sha256', 'prompt.md'), ('judge_sha256', 'judge.toml')]:
        assert provenance['judges'][dimension][key] == sha(files[f'tests/{dimension}/{name}'])
write('prompt-provenance.json', provenance)
write('source-hashes.json', {name: sha(data) for name, data in files.items()})
write('changes.json', {'baseline_zip': BASE.relative_to(ROOT).as_posix(), 'baseline_sha256': sha(BASE.read_bytes()), 'changed_files': changed, 'all_judge_criteria_and_weights_unchanged': True, 'global_gates_unchanged': True, 'configuration_unchanged': True})
(OUT / 'changes.diff').write_text(''.join(''.join(difflib.unified_diff(previous[name].decode().splitlines(True), files[name].decode().splitlines(True), fromfile='r11/' + name, tofile='r12/' + name)) for name in changed), encoding='utf-8')
write('agent-expected-hashes.json', {name.removeprefix('environment/'): sha(data) for name, data in files.items() if name.startswith(('environment/instructions/', 'environment/assets/'))})
agent_check = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '--mount', f'type=bind,source={OUT},target=/validation,readonly', 'ballot-agent:20260914-r12-local', 'node', '/validation/agent-smoke.cjs'], capture_output=True, text=True, check=True)
write('agent-smoke-results.json', json.loads(agent_check.stdout))
write('image-hashes.json', {'build_type': 'Cached dependencies with current source; exact clean builds failed at package-proxy resolution.', 'images': {tag: json.loads(subprocess.check_output(['docker', 'image', 'inspect', tag], text=True))[0]['Id'] for tag in ['ballot-agent:20260914-r12-local', 'ballot-verifier:20260914-r12-local']}})
DELIVERY.mkdir(parents=True, exist_ok=True)
archive_path = DELIVERY / 'common-ground-ballot.zip'
if not archive_path.exists():
    with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            entry = zipfile.ZipInfo('common-ground-ballot/' + name, (2026, 9, 14, 12, 0, 0))
            entry.create_system = 3
            entry.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, data)
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None and len(archive.namelist()) == 36
    assert all(archive.read('common-ground-ballot/' + name) == data for name, data in files.items())
    extracted = OUT / 'extracted-candidate'
    archive.extractall(extracted)
    extracted_checks = standard.validate(extracted / 'common-ground-ballot')
    assert {k:v for k,v in extracted_checks.items() if k != 'task'} == {k:v for k,v in standard_checks.items() if k != 'task'}
check = subprocess.run(['python', str(ROOT / 'references/task-templates/check-upload.py'), str(archive_path), '--output', str(OUT / 'upload-check.json')], capture_output=True, text=True, encoding='utf-8', errors='replace')
(OUT / 'upload-check.log').write_text(check.stdout + '\n' + check.stderr, encoding='utf-8')
assert check.returncode == 0, check.stderr
write('package-audit.json', {'archive': archive_path.relative_to(ROOT).as_posix(), 'zip_sha256': sha(archive_path.read_bytes()), 'file_count': 36, 'exact_source_bytes_verified': True, 'standard_checks': len(standard_checks['checks']), 'local_check_groups': counts, 'original_golden_failed_feedback_and_duplicate_login_controls': True, 'clean_docker_build_passed': False, 'cached_dependency_assembly_passed': True, 'fresh_scored_oracle_run': False, 'fresh_gpt_run': False, 'platform_qc': False, 'generic_upload_check_passed': True})
for name in ['README.md', 'input-run-audit.json', 'changes.json', 'changes.diff', 'source-hashes.json', 'prompt-provenance.json', 'standard-checks.json', 'package-audit.json', 'image-hashes.json', 'agent-smoke-results.json', 'upload-check.json']:
    shutil.copyfile(OUT / name, DELIVERY / name)
shutil.copyfile(BASE.parent / 'coverage.json', DELIVERY / 'coverage.json')
(DELIVERY / 'SHA256SUMS.txt').write_text(sha(archive_path.read_bytes()) + '  common-ground-ballot.zip\n')
print(json.dumps(json.loads((OUT / 'package-audit.json').read_text()), indent=2))
