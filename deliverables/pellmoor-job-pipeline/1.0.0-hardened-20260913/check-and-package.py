import ast
import hashlib
import json
import math
import re
import sys
import tempfile
import tomllib
import zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/pellmoor-job-pipeline'
sha = lambda data: hashlib.sha256(data).hexdigest()
report = json.loads((OUT / 'hardening-report.json').read_text())
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert {name: sha(data) for name, data in files.items()} == report['final_source_hashes']
old = OUT / 'source-before-hardening'
assert {p.relative_to(old).as_posix(): sha(p.read_bytes()) for p in old.rglob('*') if p.is_file()} == report['baseline_source_hashes']
assert len(files) == 32
assert files['tests/pellmoor_seed_data.json'] == files['environment/assets/recruitment/records/pellmoor_seed_data.json']
assert sha(files['tests/pellmoor_seed_data.json']) == report['baseline_source_hashes']['tests/pellmoor_seed_data.json']
for name, data in files.items():
    assert b'\r\n' not in data, name
    assert not any(p in ('node_modules', '.git', '__pycache__', 'reports') for p in Path(name).parts)
    assert Path(name).suffix not in ('.db', '.sqlite', '.zip', '.log', '.pyc')
    assert not Path(name).name.startswith('.env')
    assert not re.search(rb'(?:sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}', data)
    if name.endswith('.toml'):
        tomllib.loads(data.decode())
copy_map = {}
for line in files['environment/Dockerfile'].decode().splitlines():
    if line.startswith('COPY '):
        _, source, destination = line.split()
        assert (TASK / 'environment' / source).exists(), source
        copy_map[destination] = source
references = re.findall(r'`(/instructions/[^`]+)`', files['instruction.md'].decode())
assert len(references) == 4
for ref in references:
    assert 'environment' + ref in files
    assert copy_map[ref] == ref.lstrip('/')
assert json.loads((OUT / 'standard-check.json').read_text())['passed']
for name in ('regressions.json', 'hardening-regressions.json'):
    assert all(x['status'] == 'passed' for x in json.loads((OUT / name).read_text())['results'])
assert all(x['baseline_passed'] and x['mutant_detected'] for x in json.loads((OUT / 'mutation-probes.json').read_text())['results'])
script = files['tests/test.sh'].decode()
chunks = re.findall(r"<<'PY'\n(.*?)\nPY", script, re.S)
assert len(chunks) == 4
for chunk in chunks:
    ast.parse(chunk)
code = compile(chunks[-1], 'reward-postprocess', 'exec')
base = dict(render=1, constraints=1, functional=1, polish=1, visual=1)
cases = [
    ('all-one', base, 1),
    ('render-zero', {**base, 'render': 0}, 0),
    ('constraints-zero', {**base, 'constraints': 0}, 0),
    ('partial', dict(render=.1, constraints=.2, functional=.5, polish=.8, visual=.6), .58),
    ('missing', {k: v for k, v in base.items() if k != 'visual'}, None),
    ('boolean', {**base, 'render': True}, None),
    ('nan', {**base, 'functional': math.nan}, None),
    ('infinity', {**base, 'visual': math.inf}, None),
    ('range', {**base, 'functional': 1.1}, None),
    ('string', {**base, 'functional': '1'}, None),
]
for name, values, expected in cases:
    with tempfile.TemporaryDirectory(prefix='pellmoor-final-') as temporary:
        temp = Path(temporary)
        source = temp / 'reward.json'
        source.write_text(json.dumps(values))
        saved = sys.argv
        sys.argv = ['reward', str(source), str(temp / 'reward.txt'), str(temp / 'ctrf.json')]
        try:
            try:
                exec(code, {})
            except ValueError:
                assert expected is None, name
            else:
                assert expected is not None, name
                assert json.loads(source.read_text())['reward'] == expected, name
        finally:
            sys.argv = saved
archive = OUT / 'pellmoor-job-pipeline.zip'
assert not archive.exists(), 'Do not overwrite a delivered ZIP'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo('pellmoor-job-pipeline/' + name, (2026, 9, 13, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {n.split('/', 1)[1]: z.read(n) for n in z.namelist()} == files
result = dict(archive=str(archive), sha256=sha(archive.read_bytes()), files=len(files),
              instruction_references_verified=references, reward_cases=len(cases),
              source_sha256=report['final_source_hashes'], platform_qc_run=False,
              paid_oracle_or_target_model_run=False)
(OUT / 'package-verification.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'source_sha256'}, indent=2))
