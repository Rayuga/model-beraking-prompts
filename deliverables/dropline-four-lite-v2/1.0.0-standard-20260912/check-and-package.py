import ast
import hashlib
import json
import math
import re
import tempfile
import tomllib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
TASK = ROOT / 'projects/dropline-four-lite-v2'
sha = lambda data: hashlib.sha256(data).hexdigest()
baseline = json.loads((OUT / 'baseline.json').read_text())
old = Path(baseline['original'])
assert {p.relative_to(old).as_posix(): sha(p.read_bytes()) for p in old.rglob('*') if p.is_file()} == baseline['hashes'], 'Original task changed'
task = tomllib.loads((TASK / 'task.toml').read_text())
assert task['environment']['network_mode'] == task['verifier']['environment']['network_mode'] == 'public'
script = (TASK / 'tests/test.sh').read_text()
assert not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY', script)
for p in [TASK / 'tests/Dockerfile', TASK / 'environment/Dockerfile']:
    assert not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY', p.read_text())
chunks = re.findall(r"<<'PY'\n(.*?)\nPY", script, re.S)
assert len(chunks) == 4
for chunk in chunks:
    ast.parse(chunk)
code = compile(chunks[-1], str(TASK / 'tests/test.sh') + ':reward-postprocess', 'exec')
cases = [
    ('all-one', dict(render=1, constraints=1, functional=1, polish=1, visual=1), 1),
    ('render-zero', dict(render=0, constraints=1, functional=1, polish=1, visual=1), 0),
    ('constraint-zero', dict(render=1, constraints=0, functional=1, polish=1, visual=1), 0),
    ('positive-partial-gates', dict(render=.1, constraints=.2, functional=.5, polish=.8, visual=.6), .58),
    ('missing-visual', dict(render=1, constraints=1, functional=1, polish=1), None),
    ('boolean', dict(render=True, constraints=1, functional=1, polish=1, visual=1), None),
    ('nan', dict(render=1, constraints=1, functional=math.nan, polish=1, visual=1), None),
    ('infinity', dict(render=1, constraints=1, functional=1, polish=1, visual=math.inf), None),
    ('out-of-range', dict(render=1, constraints=1, functional=1.1, polish=1, visual=1), None),
    ('string', dict(render=1, constraints=1, functional='1', polish=1, visual=1), None),
]
checks = []
import sys
for name, values, expected in cases:
    with tempfile.TemporaryDirectory(prefix='dropline-reward-') as temporary:
        temp = Path(temporary)
        source = temp / 'reward.json'
        source.write_text(json.dumps(values))
        saved = sys.argv
        sys.argv = ['reward', str(source), str(temp/'reward.txt'), str(temp/'ctrf.json')]
        try:
            try:
                exec(code, {})
            except ValueError:
                assert expected is None, name
            else:
                assert expected is not None, name
                assert json.loads(source.read_text())['reward'] == expected, name
                assert json.loads((temp/'ctrf.json').read_text())['summary']['total'] == 5
        finally:
            sys.argv = saved
    checks.append({'name': name, 'passed': True})
files = sorted(p for p in TASK.rglob('*') if p.is_file())
for p in files:
    rel = p.relative_to(TASK)
    assert not p.is_symlink()
    assert not any(part in ('node_modules', '__pycache__', '.git', 'reports') for part in rel.parts)
    assert p.suffix not in ('.db', '.sqlite', '.pyc', '.log', '.zip')
    assert not p.name.startswith('.env')
    if p.suffix == '.toml':
        tomllib.loads(p.read_text())
    if p.suffix in ('.sh', '.toml', '.md', '.js', '.html', '.json') or p.name == 'Dockerfile':
        assert not re.search(r'(?i)(?:sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}', p.read_text())
        assert '6.0.3' not in p.read_text()
assert (TASK/'environment/assets/artifacts/dropline_seed.xlsx').read_bytes() == (TASK/'tests/assets/artifacts/dropline_seed.xlsx').read_bytes()
archive = OUT / 'dropline-four-lite-v2.zip'
hashes = {}
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for p in files:
        name = 'dropline-four-lite-v2/' + p.relative_to(TASK).as_posix()
        data = p.read_bytes()
        info = zipfile.ZipInfo(name, date_time=(2026, 9, 12, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (0o100755 if p.suffix == '.sh' else 0o100644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
        hashes[name] = sha(data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {i.filename.split('/')[0] for i in z.infolist()} == {'dropline-four-lite-v2'}
    assert {i.filename: sha(z.read(i)) for i in z.infolist()} == hashes
result = dict(original_unchanged=True, public_network_both=True, source_file_count=len(files), source_hashes=hashes, zip_sha256=sha(archive.read_bytes()), reward_cases=checks)
(OUT/'package-verification.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(dict(zip=str(archive), sha256=result['zip_sha256'], files=len(files), reward_cases=len(checks), original_unchanged=True), indent=2))
