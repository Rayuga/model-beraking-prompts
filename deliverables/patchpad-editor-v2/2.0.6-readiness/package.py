"""Audit and export only PatchPad 2.0.6; keep historical archives unchanged."""
import hashlib
import json
from pathlib import Path
import stat
import subprocess
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root/'projects/patchpad-editor-v2'
slug = 'patchpad-editor-v2'
sha = lambda b: hashlib.sha256(b).hexdigest()
old_zip = out.parent/'2.0.5-preflight/patchpad-editor-v2.zip'
assert sha(old_zip.read_bytes()) == '5d551d9f2b11a45e27045298f8a90fb4a63a978bcf6596df6813feb19229dcee'
with zipfile.ZipFile(old_zip) as z:
    old = {n.removeprefix(slug+'/'):z.read(n) for n in z.namelist()}
current = {p.relative_to(task).as_posix():p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert set(old) == set(current) and len(current) == 30
assert all(b'\r' not in b and not b.startswith(b'\xef\xbb\xbf') for b in current.values())
for name,data in current.items():
    if name.endswith('.json'): json.loads(data)
    if name.endswith('.toml'): tomllib.loads(data.decode())
    assert b'sk-or-v1-' not in data
    if name != 'tests/test.sh':
        assert data == old[name].replace(b'2.0.5',b'2.0.6'), name
runner = current['tests/test.sh'].decode()
begin = runner.index('# Explicit readiness probe before grading.')
end = runner.index('if ! timeout --signal=TERM', begin)
assert (runner[:begin]+runner[end:]).encode() == old['tests/test.sh']
assert runner.index('urllib.request.urlopen') < runner.index('rewardkit --max-concurrent-agent')
assert 'time.monotonic() + 60' in runner
assert current['tests/app-lifecycle.sh'] == old['tests/app-lifecycle.sh']
config = tomllib.loads(current['task.toml'].decode())
assert config['task']['version'] == '2.0.6'
assert config['environment']['network_mode'] == config['verifier']['environment']['network_mode'] == 'public'
counts = {}
for dimension in ('render','constraints','functional','polish'):
    name = f'tests/{dimension}/judge.toml'
    judge = tomllib.loads(current[name].decode())
    assert judge == tomllib.loads(old[name].decode())
    counts[dimension] = len(judge['criterion'])
assert counts == dict(render=2,constraints=2,functional=27,polish=4)
for case in ('delayed-bind','delayed-entry','unavailable-entry','crash'):
    assert json.loads((out/f'readiness-{case}.json').read_text())['passed']
assert (out/'local-validation.json').exists()
assert json.loads((out/'harness-integration.json').read_text())['two_restarts_and_final_cleanup'] == 'passed'
images = {}
for role in ('env','tests'):
    image = json.loads(subprocess.check_output(['docker','image','inspect',f'patchpad-preflight-{role}:2.0.6']))[0]
    assert image['Config']['Labels']['io.turing.task.version'] == '2.0.6'
    images[role] = image['Id']
archive = out/(slug+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(current.items()):
        info = zipfile.ZipInfo(slug+'/'+name,(2026,9,10,0,0,0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | (0o755 if name.endswith('.sh') else 0o644)) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info,data)
hashes = {n:sha(b) for n,b in current.items()}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist()) == 30
    assert {n.removeprefix(slug+'/'):sha(z.read(n)) for n in z.namelist()} == hashes
report = dict(version='2.0.6', archive=archive.name, sha256=sha(archive.read_bytes()), files=hashes, images=images, criteria=counts, networks='public/public', changes='Readiness gate in test.sh and release markers only relative to 2.0.5', scope='Local unpaid evidence; platform static checker and Oracle not run')
(out/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'SHA256SUMS.txt').write_text(report['sha256']+'  '+archive.name+'\n')
print(json.dumps({k:v for k,v in report.items() if k != 'files'},indent=2))
