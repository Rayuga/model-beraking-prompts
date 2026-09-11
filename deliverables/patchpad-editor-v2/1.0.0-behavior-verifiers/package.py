from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
spec = importlib.util.spec_from_file_location('standard', ROOT / 'references/task-templates/check-standard.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
result = module.validate(TASK)
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files) == 32, len(files)
assert not any(any(part in {'node_modules', '__pycache__', '.git'} for part in Path(n).parts) for n in files)
assert not any(n.endswith(('.db', '.sqlite', '.log', '.png', '.zip', '.pyc')) for n in files)
with zipfile.ZipFile(OUT / 'before-behavior-verifiers.zip') as archive:
    before = {n.split('/', 1)[1]: archive.read(n) for n in archive.namelist()}
assert files.keys() == before.keys()
changed = sorted(n for n in files if before[n] != files[n])
assert changed == ['tests/functional/judge.toml', 'tests/functional/prompt.md'], changed
changes = json.loads((OUT / 'verifier-changes.json').read_text(encoding='utf-8'))
old_judge = tomllib.loads(before['tests/functional/judge.toml'].decode('utf-8'))
new_judge = tomllib.loads(files['tests/functional/judge.toml'].decode('utf-8'))
restored = copy.deepcopy(new_judge)
changed_ids = []
for old, new, restore in zip(old_judge['criterion'], new_judge['criterion'], restored['criterion'], strict=True):
    assert old['id'] == new['id']
    if old['description'] != new['description']:
        changed_ids.append(old['id'])
        record = next(c for c in changes if c['id'] == old['id'])
        assert record['before'] == old['description'].strip()
        assert record['after'] == new['description'].strip()
        restore['description'] = old['description']
assert set(changed_ids) == {c['id'] for c in changes}
assert len(changed_ids) == 4
assert restored == old_judge
for name, data in files.items():
    if name.endswith('.toml'):
        tomllib.loads(data.decode('utf-8'))
        assert not any(line.lstrip().startswith(b'#') for line in data.splitlines()), name
assert files['environment/assets/incident_seed.json'] == files['tests/incident_seed.json']
archive_path = OUT / 'patchpad-editor-v2.zip'
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo('patchpad-editor-v2/' + name, (2026, 9, 11, 0, 0, 0))
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        archive.writestr(info, data)
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    assert {n.split('/', 1)[1]: archive.read(n) for n in archive.namelist()} == files
sha = lambda data: hashlib.sha256(data).hexdigest()
report = dict(task='patchpad-editor-v2', version='1.0.0', file_count=len(files),
              zip_sha256=sha(archive_path.read_bytes()), changed_since_no_comments=changed,
              changed_criteria=changed_ids, other_parsed_judge_values_preserved=True,
              standard_checks=len(result['checks']), files={n: sha(d) for n, d in files.items()})
(OUT / 'package-audit.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}, indent=2))
