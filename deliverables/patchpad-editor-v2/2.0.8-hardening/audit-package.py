"""Validate a narrowly scoped release and export only the task, not evidence."""
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
slug = 'patchpad-editor-v2'
task = root / 'projects' / slug
sha = lambda b: hashlib.sha256(b).hexdigest()
previous = out.parent / '2.0.7-oracle-review' / (slug + '.zip')
assert sha(previous.read_bytes()) == '519499a273db36a057184b630f7dc89a6f4800fa8583113f92fd39517ec5cae8'
with zipfile.ZipFile(previous) as z:
    old = {n.removeprefix(slug + '/'): z.read(n) for n in z.namelist()}
files = {p.relative_to(task).as_posix(): p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert set(files) == set(old) and len(files) == 30
app = 'solution/app/public/js/app.js'
for name, data in files.items():
    assert b'\r' not in data and not data.startswith(b'\xef\xbb\xbf'), name
    assert not re.search(rb'sk-or-v1-[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----', data), name
    if name.endswith('.json'):
        json.loads(data)
    if name.endswith('.toml'):
        tomllib.loads(data.decode())
    if name != app:
        assert data == old[name].replace(b'2.0.7', b'2.0.8'), name

# Only the two confirmed golden defects may differ beyond release markers.
def omit_repaired_functions(data):
    for start, end in ((b'async function readClipboard()', b'async function copySelection()'),
                       (b'function pointToPosition(event)', b'let cachedCharWidth')):
        begin = data.index(start)
        finish = data.index(end, begin)
        data = data[:begin] + data[finish:]
    return data
assert omit_repaired_functions(files[app]) == omit_repaired_functions(old[app])
assert b'if (text) return text;' not in files[app]
assert b'range.getBoundingClientRect()' in files[app]

cfg = tomllib.loads(files['task.toml'].decode())
assert cfg['task']['name'] == 'turing/' + slug and cfg['task']['version'] == '2.0.8'
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
assert cfg['verifier']['environment_mode'] == 'separate'
assert cfg['environment']['build_timeout_sec'] + cfg['agent']['timeout_sec'] + cfg['verifier']['timeout_sec'] <= 21600
counts = {}
for dim in ('render', 'constraints', 'functional', 'polish'):
    name = f'tests/{dim}/judge.toml'
    current = tomllib.loads(files[name].decode())
    assert current == tomllib.loads(old[name].decode())
    assert current['judge']['model'] == 'openai/gpt-5.6-luna'
    assert current['judge']['reasoning_effort'] == 'high'
    counts[dim] = len(current['criterion'])
    for n in (name, f'tests/{dim}/prompt.md'):
        assert 'v2.0.8' in files[n].splitlines()[0].decode()
assert counts == dict(render=2, constraints=2, functional=27, polish=4)
for name in ('tests/test.sh', 'tests/app-lifecycle.sh', 'tests/reward.toml'):
    assert files[name] == old[name]
assert b'http://127.0.0.1:3000/' in files['tests/test.sh']

groups = {}
for name, expected in (('browser-variants', 6), ('additional-regression', 14), ('oracle-failures-regression', 8)):
    result = json.loads((out / (name + '.json')).read_text())['results']
    assert len(result) == expected and all(c['passed'] for c in result)
    groups[name] = len(result)
local = json.loads((out / 'local-validation.json').read_text())
assert local['syntax_and_empty_submission'] == 'passed'
assert len(local['manifest_parser']['accepted']) == 5
assert local['manifest_parser']['invalid_cases_rejected'] == 6
assert json.loads((out / 'harness-integration.json').read_text())['two_restarts_and_final_cleanup'] == 'passed'
assert all(c['rejected'] for c in json.loads((out / 'coverage-negative-controls.json').read_text()))
assert len(json.loads((out / 'release-progress.json').read_text())) == 5
state = json.loads(subprocess.check_output(['docker', 'inspect', 'patchpad-208-release-check']))[0]['State']
assert state['Status'] == 'exited' and state['ExitCode'] == 0
images = {role: json.loads(subprocess.check_output(['docker', 'image', 'inspect', f'patchpad-preflight-{role}:2.0.8']))[0]['Id'] for role in ('env', 'tests')}

archive = out / (slug + '.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(slug + '/' + name, (2026, 9, 10, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if name.endswith('.sh') else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
hashes = {n: sha(data) for n, data in files.items()}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(set(z.namelist())) == 30
    assert {n.removeprefix(slug + '/'): sha(z.read(n)) for n in z.namelist()} == hashes
report = dict(version='2.0.8', archive=archive.name, sha256=sha(archive.read_bytes()),
              files=hashes, images=images, criteria=counts, focused_regression_groups=groups,
              criteria_instructions_weights_unchanged=True, public_agent_and_verifier=True,
              preserved_readiness_manifest_parser_single_restart_helper=True,
              source_changes=['grapheme-boundary mouse hit testing', 'empty clipboard respected', 'release markers'],
              scope='Unpaid local validation only. No platform QC, Oracle or model run for 2.0.8.')
(out / 'package-audit.json').write_text(json.dumps(report, indent=2) + '\n')
(out / 'SHA256SUMS.txt').write_text(report['sha256'] + '  ' + archive.name + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ('files', 'images')}, indent=2))
