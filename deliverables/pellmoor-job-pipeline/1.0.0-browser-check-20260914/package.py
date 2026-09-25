from pathlib import Path
import difflib
import hashlib
import json
import subprocess
import sys
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/pellmoor-job-pipeline'
BASE = OUT.parent / '1.0.0-batch-offers-20260914'
sha = lambda data: hashlib.sha256(data).hexdigest()
baseline = json.loads((BASE / 'package-verification.json').read_text())
assert sha((BASE / 'pellmoor-job-pipeline.zip').read_bytes()) == baseline['zip_sha256']
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert set(files) == set(baseline['source_sha256'])
changed = [name for name, data in files.items() if sha(data) != baseline['source_sha256'][name]]
assert changed == ['instruction.md'], changed
assert all(b'\r\n' not in data for data in files.values())
with zipfile.ZipFile(BASE / 'pellmoor-job-pipeline.zip') as previous:
    original = previous.read('pellmoor-job-pipeline/instruction.md')
assert files['instruction.md'].startswith(original)
assert 'real browser' in files['instruction.md'].decode()
(OUT / 'instruction-change.diff').write_text(''.join(difflib.unified_diff(original.decode().splitlines(True), files['instruction.md'].decode().splitlines(True), fromfile='previous/instruction.md', tofile='current/instruction.md')), encoding='utf-8')
archive = OUT / 'pellmoor-job-pipeline.zip'
assert not archive.exists(), 'Do not overwrite frozen packages'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo('pellmoor-job-pipeline/' + name, (2026, 9, 14, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        package.writestr(info, data)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert {name.split('/', 1)[1]: package.read(name) for name in package.namelist()} == files
    package.extractall(OUT / 'task')
results = {}
for name, arguments in [
    ('standard', [str(OUT / 'task/pellmoor-job-pipeline')]),
    ('upload', [str(archive)]),
]:
    command = [sys.executable, str(ROOT / f'references/task-templates/check-{name}.py'), *arguments, '--output', str(OUT / f'{name}-qc.json')]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    (OUT / f'{name}-qc.log').write_text(result.stdout + result.stderr, encoding='utf-8')
    results[name] = {'passed': result.returncode == 0, 'exit_code': result.returncode}
report = {'status': 'Packaged; fresh platform Oracle and GPT results pending', 'zip_sha256': sha(archive.read_bytes()), 'previous_zip_sha256': baseline['zip_sha256'], 'files': len(files), 'changed_files': changed, 'task_version': '1.0.0', 'all_60_criteria_and_weights_unchanged': True, 'golden_source_unchanged': True, 'all_verifier_files_unchanged': True, 'configuration_and_timeouts_unchanged': True, 'local_checks': results, 'source_sha256': {name: sha(data) for name, data in sorted(files.items())}, 'fresh_platform_runs': False}
(OUT / 'package-verification.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'source_sha256'}, indent=2))
