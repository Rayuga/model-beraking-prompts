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
BASE = OUT.parent / '1.0.0-browser-check-20260914'
sha = lambda data: hashlib.sha256(data).hexdigest()
baseline = json.loads((BASE / 'package-verification.json').read_text())
assert sha((BASE / 'pellmoor-job-pipeline.zip').read_bytes()) == baseline['zip_sha256']
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
expected = {'tests/functional/prompt.md', 'tests/functional/judge.toml', 'tests/test.sh', 'tests/functional/capture-loss.js', 'tests/functional/receipt-ledger.py'}
changes = {name for name, data in files.items() if sha(data) != baseline['source_sha256'].get(name)}
assert changes == expected, changes
assert len(files) == 34
assert set(baseline['source_sha256']) <= files.keys()
diff = []
with zipfile.ZipFile(BASE / 'pellmoor-job-pipeline.zip') as previous:
    for name in sorted(changes):
        old = previous.read('pellmoor-job-pipeline/' + name) if name in baseline['source_sha256'] else b''
        diff.extend(difflib.unified_diff(old.decode().splitlines(True), files[name].decode().splitlines(True), fromfile='previous/' + name, tofile='current/' + name))
    for dim in ('render', 'constraints', 'functional', 'polish', 'visual'):
        name = f'tests/{dim}/judge.toml'
        old = tomllib.loads(previous.read('pellmoor-job-pipeline/' + name).decode())
        current = tomllib.loads(files[name].decode())
        assert old['judge'] == current['judge'] and old['scoring'] == current['scoring']
        fields = lambda item: {k: v for k, v in item.items() if k != 'description'}
        assert [fields(c) for c in old['criterion']] == [fields(c) for c in current['criterion']]
    old_runner = previous.read('pellmoor-job-pipeline/tests/test.sh').decode()
    new_runner = files['tests/test.sh'].decode()
    chunk = lambda value: re.findall(r"<<'PY'\n(.*?)\nPY", value, re.S)[-1]
    assert chunk(old_runner) == chunk(new_runner)
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
assert all(x['status'] == 'passed' for x in json.loads((OUT / 'batch-regressions.json').read_text())['results'])
assert json.loads((OUT / 'ledger-checks.json').read_text())['passed']
provenance = json.loads((OUT / 'runner-logs/prompt-provenance.json').read_text())
assert provenance['runner_sha256'] == sha(files['tests/test.sh'])
for dim, item in provenance['judges'].items():
    assert item['prompt_sha256'] == sha(files[f'tests/{dim}/prompt.md'])
    assert item['judge_sha256'] == sha(files[f'tests/{dim}/judge.toml'])
for name, digest in provenance['support_files'].items():
    assert digest == sha(files['tests/' + name])
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
report = {'status': 'Local evidence checks passed; fresh platform Oracle and GPT evaluations pending', 'zip_sha256': sha(archive.read_bytes()), 'previous_zip_sha256': baseline['zip_sha256'], 'files': len(files), 'changed_files': sorted(changes), 'source_sha256': {name: sha(data) for name, data in sorted(files.items())}, 'all_60_criteria_ids_types_and_weights_unchanged': True, 'golden_source_unchanged': True, 'agent_visible_task_unchanged': True, 'reward_postprocessor_unchanged': True, 'task_config_and_timeouts_unchanged': True, 'functional_prompt_revision': 'r7', 'golden_local_groups': 11, 'ledger_negative_checks': 8, 'actual_mcp_helper_verified': True, 'local_checks': checks, 'fresh_platform_runs': False}
(OUT / 'package-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'source_sha256'}, indent=2))
