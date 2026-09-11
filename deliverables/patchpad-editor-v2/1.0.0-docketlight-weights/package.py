from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
REFERENCE = ROOT / 'projects/docketlight-claims-insurance'
BASELINE = OUT / 'before-docketlight-weights.zip'
if not BASELINE.exists():
    shutil.copyfile(OUT.parent / '1.0.0-behavior-verifiers/patchpad-editor-v2.zip', BASELINE)
spec = importlib.util.spec_from_file_location('standard', ROOT / 'references/task-templates/check-standard.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
result = module.validate(TASK)
(OUT / 'standard-checks.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(BASELINE) as archive:
    before = {n.split('/', 1)[1]: archive.read(n) for n in archive.namelist()}
assert len(files) == 32 and files.keys() == before.keys()
changed = sorted(n for n in files if files[n] != before[n])
expected = {'functional': (4.0, 0.6), 'polish': (3.0, 0.2), 'visual': (2.0, 0.2)}
assert changed == sorted(f'tests/{dim}/judge.toml' for dim in expected), changed
weights = {}
for dim in ('render', 'constraints', 'functional', 'polish', 'visual'):
    name = f'tests/{dim}/judge.toml'
    old = tomllib.loads(before[name].decode('utf-8'))
    new = tomllib.loads(files[name].decode('utf-8'))
    reference = tomllib.loads((REFERENCE / name).read_text(encoding='utf-8'))
    weights[dim] = {'before': old['judge']['weight'], 'after': new['judge']['weight']}
    assert new['judge']['weight'] == reference['judge']['weight']
    if dim in expected:
        assert (old['judge']['weight'], new['judge']['weight']) == expected[dim]
        old['judge']['weight'] = new['judge']['weight']
    assert old == new, dim
for name, data in files.items():
    if name.endswith('.toml'):
        tomllib.loads(data.decode('utf-8'))
        assert not any(line.lstrip().startswith(b'#') for line in data.splitlines()), name
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
              zip_sha256=sha(archive_path.read_bytes()), changed_files=changed,
              judge_weights=weights, weight_reference=str(REFERENCE),
              other_parsed_values_preserved=True, standard_checks=len(result['checks']),
              files={n: sha(data) for n, data in files.items()})
(OUT / 'package-audit.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}, indent=2))
