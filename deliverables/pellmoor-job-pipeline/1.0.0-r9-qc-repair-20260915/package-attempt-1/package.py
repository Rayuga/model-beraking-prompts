from pathlib import Path
import ast
import difflib
import hashlib
import json
import re
import subprocess
import sys
import tomllib
import zipfile

REPORT = Path(__file__).resolve().parent
ROOT = REPORT.parents[2]
TASK = ROOT / 'projects/pellmoor-job-pipeline'
OUT = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r9-qc-repair-20260915'
BASE = OUT.parent / '1.0.0-r8-reliability-20260914'
sha = lambda data: hashlib.sha256(data).hexdigest()
baseline = json.loads((BASE / 'package-verification.json').read_text())
assert sha((BASE / 'pellmoor-job-pipeline.zip').read_bytes()) == baseline['zip_sha256']
archive = OUT / 'pellmoor-job-pipeline.zip'
assert not archive.exists(), 'Preserve frozen packages; choose a new revision for further edits'

canonical_seed = TASK / 'environment/assets/recruitment/records/pellmoor_seed_data.json'
verifier_seed = TASK / 'tests/pellmoor_seed_data.json'
verifier_seed.write_bytes(canonical_seed.read_bytes())
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert files['tests/pellmoor_seed_data.json'] == files['environment/assets/recruitment/records/pellmoor_seed_data.json']
assert files['task.toml'] == (BASE / 'task/pellmoor-job-pipeline/task.toml').read_bytes()
assert files['tests/reward.toml'] == (BASE / 'task/pellmoor-job-pipeline/tests/reward.toml').read_bytes()
changes = {name for name, data in files.items() if sha(data) != baseline['source_sha256'].get(name)}
assert set(baseline['source_sha256']) <= files.keys()
assert all(sha(files[name]) == digest for name, digest in baseline['source_sha256'].items() if name.startswith('solution/'))
for name, data in files.items():
    assert b'\r\n' not in data, name
    if name.endswith('.toml'):
        tomllib.loads(data.decode())
    if name.endswith('.py'):
        ast.parse(data.decode())
    if name.endswith(('.js', '.ts', '.html')):
        assert not re.search(rb'^\s*(?://|/\*|<!--)', data, re.M), name
    if name.endswith(('.py', '.toml', '.sh')) or name.endswith('Dockerfile'):
        assert not re.search(rb'^\s*#(?!\!)', data, re.M), name
for dim in ('render', 'constraints', 'functional', 'polish', 'visual'):
    before = tomllib.loads((BASE / f'task/pellmoor-job-pipeline/tests/{dim}/judge.toml').read_text())
    current = tomllib.loads(files[f'tests/{dim}/judge.toml'].decode())
    assert before['judge']['timeout'] == current['judge']['timeout']
    identity = lambda criteria: [(c['id'], c['name'], c['type']) for c in criteria]
    assert identity(before['criterion']) == identity(current['criterion'])
    if dim == 'visual':
        assert before == current
chunk = lambda value: re.findall(r"<<'PY'\n(.*?)\nPY", value, re.S)[-1]
assert chunk((BASE / 'task/pellmoor-job-pipeline/tests/test.sh').read_text()) == chunk(files['tests/test.sh'].decode())
originals = json.loads((BASE / 'run-file-hashes.json').read_text())
run_root = ROOT / 'run-outputs/pellmoor-job-pipeline'
assert {p.relative_to(run_root).as_posix() for p in run_root.rglob('*') if p.is_file()} == set(originals)
assert all(sha((run_root / name).read_bytes()) == digest for name, digest in originals.items())

OUT.mkdir(parents=True, exist_ok=True)
diff = []
with zipfile.ZipFile(BASE / 'pellmoor-job-pipeline.zip') as previous:
    for name in sorted(changes):
        old = previous.read('pellmoor-job-pipeline/' + name) if name in baseline['source_sha256'] else b''
        diff.extend(difflib.unified_diff(old.decode().splitlines(True), files[name].decode().splitlines(True), fromfile='r8/' + name, tofile='r9/' + name))
(OUT / 'source-changes.diff').write_text(''.join(diff), encoding='utf-8', newline='\n')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo('pellmoor-job-pipeline/' + name, (2026, 9, 15, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        package.writestr(info, data)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert {name.split('/', 1)[1]: package.read(name) for name in package.namelist()} == files
    package.extractall(OUT / 'task')
checks = {}
for name, target in [('standard', OUT / 'task/pellmoor-job-pipeline'), ('upload', archive)]:
    command = [sys.executable, str(ROOT / f'references/task-templates/check-{name}.py'), str(target), '--output', str(OUT / f'{name}-qc.json')]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    (OUT / f'{name}-qc.log').write_text(result.stdout + result.stderr, encoding='utf-8')
    checks[name] = {'passed': result.returncode == 0, 'exit_code': result.returncode}
report = {
    'status': 'Local repair and validation; fresh platform QC and Oracle pending',
    'zip_sha256': sha(archive.read_bytes()),
    'previous_zip_sha256': baseline['zip_sha256'],
    'files': len(files),
    'changed_files': sorted(changes),
    'source_sha256': {name: sha(data) for name, data in sorted(files.items())},
    'canonical_seed_path': 'environment/assets/recruitment/records/pellmoor_seed_data.json',
    'verifier_seed_generated_from_canonical': True,
    'seed_sha256': sha(canonical_seed.read_bytes()),
    'all_60_criterion_ids_and_types_unchanged': True,
    'functional_total_weight': sum(c['weight'] for c in tomllib.loads(files['tests/functional/judge.toml'].decode())['criterion']),
    'golden_solution_unchanged': True,
    'reward_postprocessor_unchanged': True,
    'task_config_and_timeouts_unchanged': True,
    'local_checks': checks,
    'fresh_platform_runs': False,
    'preserved_run_files': len(originals),
    'evidence_directory': '../../../reports/pellmoor-job-pipeline/2026-09-15-r9-qc-repair'
}
(OUT / 'package-verification.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
assert all(c['passed'] for c in checks.values()), checks
print(json.dumps({k: v for k, v in report.items() if k != 'source_sha256'}, indent=2))
