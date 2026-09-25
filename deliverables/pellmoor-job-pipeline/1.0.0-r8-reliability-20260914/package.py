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

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/pellmoor-job-pipeline'
BASE = OUT.parent / '1.0.0-evidence-reliability-20260914'
sha = lambda data: hashlib.sha256(data).hexdigest()
baseline = json.loads((BASE / 'package-verification.json').read_text())
assert sha((BASE / 'pellmoor-job-pipeline.zip').read_bytes()) == baseline['zip_sha256']
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
changes = {name for name, data in files.items() if sha(data) != baseline['source_sha256'].get(name)}
assert set(baseline['source_sha256']) <= files.keys()
assert files['task.toml'] == (BASE / 'task/pellmoor-job-pipeline/task.toml').read_bytes()
diff = []
with zipfile.ZipFile(BASE / 'pellmoor-job-pipeline.zip') as previous:
    for name in sorted(changes):
        old = previous.read('pellmoor-job-pipeline/' + name) if name in baseline['source_sha256'] else b''
        diff.extend(difflib.unified_diff(old.decode().splitlines(True), files[name].decode().splitlines(True), fromfile='r7/' + name, tofile='r8/' + name))
    for dim in ('render', 'constraints', 'functional', 'polish', 'visual'):
        name = f'tests/{dim}/judge.toml'
        old = tomllib.loads(previous.read('pellmoor-job-pipeline/' + name).decode())
        current = tomllib.loads(files[name].decode())
        assert old['judge'] == current['judge']
        if dim in ('render', 'constraints'):
            reference = tomllib.loads((ROOT / f'projects/bazaarbridge-marketplace-commerce/tests/{dim}/judge.toml').read_text())
            assert current['scoring'] == reference['scoring'] == {'aggregation':'weighted_mean'}
        else:
            assert old['scoring'] == current['scoring']
        fields = lambda item: {k: v for k, v in item.items() if k != 'description'}
        assert [fields(c) for c in old['criterion']] == [fields(c) for c in current['criterion']]
    chunk = lambda value: re.findall(r"<<'PY'\n(.*?)\nPY", value, re.S)[-1]
    assert chunk(previous.read('pellmoor-job-pipeline/tests/test.sh').decode()) == chunk(files['tests/test.sh'].decode())
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
groups = json.loads((OUT / 'batch-regressions.json').read_text())['results']
assert len(groups) == 13 and all(x['status'] == 'passed' for x in groups)
mcp = json.loads((OUT / 'mcp-preserve-primary-results.json').read_text())
assert mcp['passed'] and mcp['helper_sha256'] == sha(files['tests/functional/preserve-primary.js'])
provenance = json.loads((OUT / 'runner-logs/prompt-provenance.json').read_text())
assert provenance['runner_sha256'] == sha(files['tests/test.sh'])
for dim, item in provenance['judges'].items():
    assert item['prompt_sha256'] == sha(files[f'tests/{dim}/prompt.md'])
    assert item['judge_sha256'] == sha(files[f'tests/{dim}/judge.toml'])
for name, digest in provenance['support_files'].items():
    assert digest == sha(files['tests/' + name])
originals = json.loads((OUT / 'run-file-hashes.json').read_text())
run_root = ROOT / 'run-outputs/pellmoor-job-pipeline'
assert all(sha((run_root / name).read_bytes()) == digest for name, digest in originals.items())
(OUT / 'source-changes.diff').write_text(''.join(diff), encoding='utf-8', newline='\n')
archive = OUT / 'pellmoor-job-pipeline.zip'
assert not archive.exists(), 'Preserve frozen packages'
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
checks = {}
for name, target in [('standard', OUT / 'task/pellmoor-job-pipeline'), ('upload', archive)]:
    command = [sys.executable, str(ROOT / f'references/task-templates/check-{name}.py'), str(target), '--output', str(OUT / f'{name}-qc.json')]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    (OUT / f'{name}-qc.log').write_text(result.stdout + result.stderr, encoding='utf-8')
    checks[name] = {'passed': result.returncode == 0, 'exit_code': result.returncode}
report = {'status': 'Fresh platform Oracle and GPT evaluations pending', 'zip_sha256': sha(archive.read_bytes()), 'previous_zip_sha256': baseline['zip_sha256'], 'files': len(files), 'changed_files': sorted(changes), 'source_sha256': {name: sha(data) for name, data in sorted(files.items())}, 'all_60_criteria_ids_types_and_weights_unchanged': True, 'aggregation_alignment': {'render':{'previous':'all_pass','current':'weighted_mean'},'constraints':{'previous':'all_pass','current':'weighted_mean'}}, 'golden_backend_unchanged': sha(files['solution/backend/server.js']) == baseline['source_sha256']['solution/backend/server.js'], 'reward_postprocessor_unchanged': True, 'task_config_and_timeouts_unchanged': True, 'functional_prompt_revision': 'r8', 'golden_local_groups': len(groups), 'actual_mcp_helper_verified': True, 'local_checks': checks, 'fresh_platform_runs': False, 'preserved_run_files': len(originals)}
(OUT / 'package-verification.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
assert all(c['passed'] for c in checks.values()), checks
print(json.dumps({k: v for k, v in report.items() if k != 'source_sha256'}, indent=2))
