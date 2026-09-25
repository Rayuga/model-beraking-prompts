"""Freeze the narrow r22 repair only after its targeted checks pass."""
import hashlib
import json
from pathlib import Path
import stat
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/common-ground-ballot'
DEST = ROOT / 'deliverables/common-ground-ballot/2026-09-16-product-gate-r22'
previous = ROOT / 'deliverables/common-ground-ballot/2026-09-16-natural-brief-r21/common-ground-ballot.zip'
with zipfile.ZipFile(previous) as archive:
    old = {info.filename.split('/', 1)[1]: archive.read(info) for info in archive.infolist()}
current = {path.relative_to(TASK).as_posix(): path.read_bytes() for path in TASK.rglob('*') if path.is_file()}
assert old.keys() == current.keys()
changes = sorted(name for name in current if old[name] != current[name])
assert changes == ['README.md', 'tests/render/judge.toml', 'tests/render/prompt.md'], changes
assert len(current) == 29
gates = json.loads((HERE / 'gate-run-results.json').read_text())
assert {row['variant'] for row in gates} == {'golden', 'readonly', 'create_only', 'publish_stub'}
assert all(row['passed'] for row in gates)
runtime = json.loads((HERE / 'runtime-results.json').read_text())
assert all(row['passed'] for row in runtime)
for filename in ('order-and-score-results.json', 'observed-control-score-results.json'):
    data = json.loads((HERE / 'order-score' / filename).read_text())
    assert data['failed'] == 0
DEST.mkdir(parents=True, exist_ok=True)
target = DEST / 'common-ground-ballot.zip'
assert not target.exists(), 'Do not overwrite a published archive'
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in sorted(current.items()):
        info = zipfile.ZipInfo('common-ground-ballot/' + name, (2026, 9, 16, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if name.endswith('.sh') else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, content)
report = {'changed_files_from_r21': changes, 'unchanged_files': len(current) - len(changes),
          'file_count': len(current), 'instruction_sha256': hashlib.sha256(current['instruction.md']).hexdigest(),
          'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
          'archive': str(target), 'bytes': target.stat().st_size}
(HERE / 'package-manifest.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(report, indent=2))
