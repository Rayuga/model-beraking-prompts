from pathlib import Path
import copy
import hashlib
import json
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
BASE = OUT.parent / '1.0.0-rubric-coverage-provenance/patchpad-editor-v2.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha(BASE.read_bytes()) == '604d91c7514882c8f3fdb2f6b8a5844eac6ba47904f2b28d41ffc71049f74fc1'
with zipfile.ZipFile(BASE) as z:
    old = {n.split('/', 1)[1]: z.read(n) for n in z.namelist()}
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files) == 32 and files.keys() == old.keys()
changed = sorted(n for n in files if files[n] != old[n])
dims = ('render', 'constraints', 'functional', 'polish', 'visual')
expected = ['environment/assets/instructions/overview.md', 'tests/functional/judge.toml', 'tests/polish/judge.toml'] + [f'tests/{d}/prompt.md' for d in dims]
assert changed == sorted(expected), changed
edits = []
counts = {}
for dim in dims:
    path = f'tests/{dim}/judge.toml'
    before = tomllib.loads(old[path].decode())
    after = tomllib.loads(files[path].decode())
    restored = copy.deepcopy(after)
    counts[dim] = len(after['criterion'])
    for a, b, c in zip(before['criterion'], after['criterion'], restored['criterion'], strict=True):
        if a['description'] != b['description']:
            edits.append(dict(dimension=dim, id=a['id'], before=a['description'], after=b['description']))
            c['description'] = a['description']
    assert before == restored, 'Non-description criterion/configuration change: ' + dim
    marker = f'Prompt version: patchpad-editor-v2-{dim}-v1.0.0-r' + ('3' if dim == 'polish' else '2')
    assert marker in files[f'tests/{dim}/prompt.md'].decode()
assert counts == dict(render=2, constraints=2, functional=27, polish=3, visual=5)
config = tomllib.loads(files['task.toml'].decode())
assert config['task']['version'] == '1.0.0'
assert config['environment']['network_mode'] == 'public'
assert config['verifier']['environment']['network_mode'] == 'public'
standard = json.loads((OUT / 'standard-checks.json').read_text())
assert standard['passed']
for kind in ('golden', 'html'):
    result = OUT / f'{kind}-attempt-1'
    assert json.loads((result / 'runtime-check.json').read_text())['passed']
    browser = json.loads((result / 'server-reads.json').read_text())
    assert len(browser['passed']) == 8
    if kind == 'html':
        assert browser['observed_read_paths'] == ['/']
archive = OUT / 'patchpad-editor-v2.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo('patchpad-editor-v2/' + name, (2026, 9, 11, 0, 0, 0))
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        z.writestr(info, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert all(n.startswith('patchpad-editor-v2/') for n in z.namelist())
    assert {n.split('/', 1)[1]: z.read(n) for n in z.namelist()} == files
report = dict(version='1.0.0', file_count=len(files), criteria=counts,
    local_standard_checks=len(standard['checks']), changed_files=changed,
    all_criterion_ids_weights_types_and_configs_preserved=True,
    golden_source_unchanged=True, runner_and_reward_unchanged=True,
    dockerfiles_and_task_toml_unchanged=True, agent_network='public', verifier_network='public',
    archive_crc_and_source_hashes_verified=True, zip_sha256=sha(archive.read_bytes()),
    full_platform_qc_run=False, full_oracle_run=False,
    source_hashes={name:sha(data) for name,data in files.items()})
(OUT / 'package-audit.json').write_text(json.dumps(report, indent=2) + '\n')
(OUT / 'verifier-changes.json').write_text(json.dumps(edits, indent=2) + '\n')
print(json.dumps({k:v for k,v in report.items() if k != 'source_hashes'}, indent=2))
