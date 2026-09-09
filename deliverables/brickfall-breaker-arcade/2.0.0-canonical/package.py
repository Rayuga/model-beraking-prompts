"""Name-only export. Preserve the accepted task under the v0 archive folder."""
import hashlib
import json
from pathlib import Path
import stat
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
slug = 'brickfall-breaker-arcade'
task = root / 'projects' / slug
archived = root / 'projects' / (slug + '-v0')
sha = lambda b: hashlib.sha256(b).hexdigest()
prior = root / 'deliverables/brickfall-breaker-arcade-v2/2.0.0/brickfall-breaker-arcade-v2.zip'
assert sha(prior.read_bytes()) == 'b7f543dd63b8852db6c7311cebeac484b8f8cafd555882b54b6e9b3af579b0d5'
with zipfile.ZipFile(prior) as z:
    before = {n.removeprefix(slug + '-v2/'): z.read(n) for n in z.namelist()}
files = {p.relative_to(task).as_posix(): p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert set(files) == set(before) and len(files) == 30
for n, data in files.items():
    expected = before[n] if n.endswith('.xlsx') else before[n].replace((slug + '-v2').encode(), slug.encode())
    assert data == expected, n
    if not n.endswith('.xlsx'):
        assert b'\r' not in data and not data.startswith(b'\xef\xbb\xbf'), n
    if n.endswith('.toml'): tomllib.loads(data.decode())
    if n.endswith('.json'): json.loads(data)
cfg = tomllib.loads(files['task.toml'].decode())
assert cfg['task']['name'] == 'turing/' + slug
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
historical = root / 'deliverables' / slug / (slug + '.zip')
assert sha(historical.read_bytes()) == '9bef39a6f1a02d1ec902cb09aab1e8e15d822a9f44c7b5e93808376af529f10f'
with zipfile.ZipFile(historical) as z:
    old = {n.removeprefix(slug + '/'): z.read(n) for n in z.namelist() if not n.endswith('/')}
archive_files = {p.relative_to(archived).as_posix(): p.read_bytes() for p in archived.rglob('*') if p.is_file()}
assert set(old) == set(archive_files)
for n, data in archive_files.items():
    assert data == old[n] if n.endswith('.xlsx') else data.replace(b'\r\n', b'\n') == old[n].replace(b'\r\n', b'\n'), n
destination = out / (slug + '.zip')
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as z:
    for n, data in sorted(files.items()):
        info = zipfile.ZipInfo(slug + '/' + n, (2026, 9, 10, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if n.endswith('.sh') else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
hashes = {n: sha(data) for n, data in files.items()}
with zipfile.ZipFile(destination) as z:
    assert z.testzip() is None and len(z.namelist()) == 30
    assert {n.removeprefix(slug + '/'): sha(z.read(n)) for n in z.namelist()} == hashes
report = dict(task=slug, version=cfg['task']['version'], sha256=sha(destination.read_bytes()),
              files=hashes, archived_original='projects/' + slug + '-v0',
              archived_original_content_unchanged=True, public_agent_and_verifier=True,
              change='Identity only; game and scoring unchanged from locally tested V2.',
              validation='Exact transformed-source comparison, TOML/JSON, LF and archive hashes. No new paid run.')
(out / 'package-audit.json').write_text(json.dumps(report, indent=2) + '\n')
(out / 'SHA256SUMS.txt').write_text(report['sha256'] + '  ' + destination.name + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}, indent=2))
