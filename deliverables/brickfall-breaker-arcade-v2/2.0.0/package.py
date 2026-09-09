"""Export the separate V2 task and prove the accepted original is restored."""
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
slug = 'brickfall-breaker-arcade-v2'
oldslug = 'brickfall-breaker-arcade'
task = root / 'projects' / slug
original = root / 'projects' / oldslug
sha = lambda data: hashlib.sha256(data).hexdigest()
historical = root / 'deliverables' / oldslug / (oldslug + '.zip')
assert sha(historical.read_bytes()) == '9bef39a6f1a02d1ec902cb09aab1e8e15d822a9f44c7b5e93808376af529f10f'
with zipfile.ZipFile(historical) as z:
    accepted = {n.removeprefix(oldslug + '/'): z.read(n) for n in z.namelist() if not n.endswith('/')}
restored = {p.relative_to(original).as_posix(): p.read_bytes() for p in original.rglob('*') if p.is_file()}
assert set(restored) == set(accepted)
for n, b in restored.items():
    if n.endswith('.xlsx'):
        assert b == accepted[n], n
    else:
        assert b.replace(b'\r\n', b'\n') == accepted[n].replace(b'\r\n', b'\n'), n
assert not subprocess.check_output(['git', 'status', '--porcelain', '--', 'projects/' + oldslug], cwd=root).strip()

prior = root / 'deliverables' / oldslug / '2.2.2-rubric' / (oldslug + '.zip')
assert sha(prior.read_bytes()) == '55e919c6a4f3f0b190ea32897457c6ee6f8837407f0932ef07a82682d0146ec4'
with zipfile.ZipFile(prior) as z:
    baseline = {n.removeprefix(oldslug + '/'): z.read(n) for n in z.namelist()}
files = {p.relative_to(task).as_posix(): p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert set(files) == set(baseline) and len(files) == 30
for n, b in files.items():
    if n.endswith('.xlsx'):
        assert b == baseline[n]
        continue
    expected = baseline[n].decode().replace(oldslug, slug).replace('2.2.2', '2.0.0')
    expected = re.sub(r'(# Prompt version: )brickfall-(render|constraints|functional|polish)-',
                      r'\1brickfall-breaker-arcade-v2-\2-', expected)
    assert b.decode() == expected, n
    assert b'\r' not in b and not b.startswith(b'\xef\xbb\xbf'), n
    assert not re.search(rb'sk-or-v1-[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----', b), n
    if n.endswith('.toml'): tomllib.loads(b.decode())
    if n.endswith('.json'): json.loads(b)
cfg = tomllib.loads(files['task.toml'].decode())
assert cfg['task']['name'] == 'turing/' + slug and cfg['task']['version'] == '2.0.0'
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
counts = {}
for dim in ('render', 'constraints', 'functional', 'polish'):
    n = f'tests/{dim}/judge.toml'
    current = tomllib.loads(files[n].decode())
    assert current == tomllib.loads(baseline[n].decode())
    counts[dim] = len(current['criterion'])
assert counts == dict(render=2, constraints=2, functional=16, polish=7)
local = json.loads((out / 'local-checks.json').read_text())
browser = json.loads((out / 'browser-regression.json').read_text())
assert local['syntax'] and local['noop_zero'] and local['golden_runner']
assert len(browser['passed']) == 12 and not browser['errors']
state = json.loads(subprocess.check_output(['docker', 'inspect', 'brickfall-v2-200-check']))[0]['State']
assert state['Status'] == 'exited' and state['ExitCode'] == 0
images = {role: json.loads(subprocess.check_output(['docker', 'image', 'inspect', f'brickfall-v2-{role}:2.0.0']))[0]['Id'] for role in ('env', 'tests')}
archive = out / (slug + '.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for n, data in sorted(files.items()):
        info = zipfile.ZipInfo(slug + '/' + n, (2026, 9, 10, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if n.endswith('.sh') else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
hashes = {n: sha(b) for n, b in files.items()}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(set(z.namelist())) == 30
    assert {n.removeprefix(slug + '/'): sha(z.read(n)) for n in z.namelist()} == hashes
report = dict(task=slug, version='2.0.0', sha256=sha(archive.read_bytes()), files=hashes,
              original_restored_to_accepted_2_2_1=True, original_git_clean=True,
              prior_archives_unchanged=True, criteria=counts, images=images,
              criteria_and_gameplay_unchanged=True, public_agent_and_verifier=True,
              scope='Local syntax, runner and 12 browser groups passed; not platform QC or Oracle.')
(out / 'package-audit.json').write_text(json.dumps(report, indent=2) + '\n')
(out / 'SHA256SUMS.txt').write_text(report['sha256'] + '  ' + archive.name + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ('files', 'images')}, indent=2))
