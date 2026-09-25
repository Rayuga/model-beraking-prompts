import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
source = root / 'projects/dropline-four-connect'
prior = out.parent / '1.0.0-shared-journeys-r4-20260914/dropline-four-connect.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
files = {p.relative_to(source).as_posix(): p.read_bytes() for p in source.rglob('*') if p.is_file()}
assert len(files) == 39
assert not any(p.is_symlink() for p in source.rglob('*'))
with zipfile.ZipFile(prior) as z:
    old = {name.removeprefix('dropline-four-connect/'): z.read(name) for name in z.namelist()}
assert files.keys() == old.keys()
changed = sorted(name for name in files if files[name] != old[name])
assert changed == ['solution/app/public/analysis.js', 'solution/solve.sh', 'tests/app-lifecycle.sh', 'tests/constraints/prompt.md', 'tests/functional/judge.toml', 'tests/functional/prompt.md', 'tests/polish/prompt.md', 'tests/render/prompt.md', 'tests/test.sh', 'tests/visual/prompt.md'], changed
for name, data in files.items():
    assert name.split('/')[0] in {'environment', 'solution', 'tests', 'instruction.md', 'task.toml'}
    assert not any(part in {'node_modules', '__pycache__', '.git', '.cache'} for part in Path(name).parts)
    assert not re.search(r'\.(db|sqlite|sqlite3|pyc|zip|log)$|(^|/)\.env', name)
    if name.endswith('.toml'):
        tomllib.loads(data.decode('utf-8'))
    if name.endswith('.json'):
        json.loads(data)
    if name.endswith('.sh'):
        assert b'\r\n' not in data
    if name.endswith(('.md', '.toml', '.js', '.css', '.html', '.sh')) or name.endswith('Dockerfile'):
        assert not re.search(r'\b(TODO|FIXME)\b|sk-proj-[A-Za-z0-9_-]{12,}|sk-or-v1-[A-Za-z0-9_-]{12,}', data.decode('utf-8'))

cfg = tomllib.loads(files['task.toml'].decode())
assert cfg['task']['version'] == '1.0.0'
assert cfg['task']['name'] == 'turing/dropline-four-connect'
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
assert cfg['verifier']['env'] == dict(OPENAI_API_KEY='${OPENAI_API_KEY}', REWARDKIT_JUDGE='codex', REWARDKIT_MODEL='gpt-5.6-luna', REWARDKIT_REASONING_EFFORT='max')
for name in ['environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh']:
    assert not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY', files[name].decode())

dims = ['render', 'constraints', 'functional', 'polish', 'visual']
counts, weights, modified = {}, {}, []
provenance = json.loads((out / 'runner-logs/prompt-provenance.json').read_text())
for dim in dims:
    key = f'tests/{dim}/judge.toml'
    now = tomllib.loads(files[key].decode())
    before = tomllib.loads(old[key].decode())
    assert now['judge'] == before['judge']
    assert now['scoring'] == before['scoring']
    assert len(now['criterion']) == len(before['criterion'])
    for current, previous in zip(now['criterion'], before['criterion']):
        for field in current.keys() | previous.keys():
            if field != 'description':
                assert current[field] == previous[field], (dim, current['id'], field)
        if current['description'] != previous['description']:
            modified.append(current['id'])
    counts[dim] = len(now['criterion'])
    weights[dim] = sum(c['weight'] for c in now['criterion'])
    for filename, key in [('judge.toml','judge_sha256'), ('prompt.md','prompt_sha256')]:
        assert sha(files[f'tests/{dim}/{filename}']) == provenance['judges'][dim][key]
assert counts == dict(render=2, constraints=2, functional=43, polish=7, visual=6)
assert len(modified) == 3
assert sha(files['tests/test.sh']) == provenance['runner_sha256']
assert sha(files['tests/reward.toml']) == provenance['reward_config_sha256']
assert provenance['judges']['functional']['prompt_version'].endswith('-r5')
assert b'2801' in files['tests/functional/judge.toml']
assert b'three depth-3 samples' in files['tests/functional/judge.toml']
assert b'Record\nseparate evidence and a verdict for every criterion' in files['tests/functional/prompt.md']
assert b'no verdict implies another' in files['tests/functional/prompt.md']
for data in [files['instruction.md'], files['environment/assets/instructions/overview.md']]:
    for name in re.findall(r'/assets/instructions/([a-z-]+\.md)', data.decode()):
        assert f'environment/assets/instructions/{name}' in files

passed = {}
for filename, count in [('regressions.json',49), ('shared-journeys.json',3), ('visual-regressions.json',3)]:
    results = json.loads((out / filename).read_text())['results']
    assert len(results) == count and all(r['passed'] for r in results)
    passed[filename] = count
assert len(json.loads((out/'tactical-fixtures.json').read_text())) == 12
for filename,count in [('oracle-pending-after.json',4),('pointer-boundary-after.json',1),('guard-positive.json',1),('proof-audit.json',9)]:
    results=json.loads((out/filename).read_text())
    assert len(results)==count and all(r['passed'] for r in results)
    passed[filename]=count
assert json.loads((out/'pointer-boundary-before.json').read_text())[0]['passed'] is False
for filename in ['cwd-normal.json','cwd-relocated.json']:
    assert json.loads((out/filename).read_text())['passed']
    passed[filename]=1
standard = json.loads((out/'standard-check.json').read_text())
assert standard['passed'] and len(standard['checks']) == 139

runner = files['tests/test.sh'].decode()
script = re.search(r'if ! python3 - "\$LOG_DIR/reward.json"[^\n]*<<\x27PY\x27\n(.*?)\nPY', runner, re.S).group(1)
valid = dict(render=1, constraints=1, functional=.5, polish=.8, visual=.6)
cases = [('weighted', valid, .58), ('render gate', {**valid, 'render':0}, 0), ('constraints gate', {**valid, 'constraints':0}, 0), ('perfect', dict.fromkeys(dims,1), 1), ('zero', dict.fromkeys(dims,0), 0)]
cases.extend((name, {**valid, 'functional':value}, None) for name,value in [('boolean',True), ('string','.5'), ('null',None), ('negative',-.1), ('above one',1.1), ('NaN',float('nan'))])
cases.append(('missing', {k:v for k,v in valid.items() if k!='functional'}, None))
formula = []
with tempfile.TemporaryDirectory(prefix='dropline-r5-formula-') as temp:
    folder = Path(temp)
    for name,data,expected in cases:
        inputfile = folder/'reward.json'
        inputfile.write_text(json.dumps(data))
        p = subprocess.run([sys.executable,'-c',script,str(inputfile),str(folder/'reward.txt'),str(folder/'ctrf.json')], capture_output=True, text=True)
        if expected is None:
            assert p.returncode != 0, name
        else:
            assert p.returncode == 0, p.stderr
            assert json.loads(inputfile.read_text())['reward'] == expected
            assert json.loads((folder/'ctrf.json').read_text())['summary']['total'] == 5
        formula.append(dict(name=name,passed=True))
(out/'reward-formula-checks.json').write_text(json.dumps(formula,indent=2))

archive = out/'dropline-four-connect.zip'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info = zipfile.ZipInfo('dropline-four-connect/'+name,(2026,9,14,0,0,0))
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(files)
    assert {name.split('/')[0] for name in z.namelist()} == {'dropline-four-connect'}
    for name,data in files.items():
        assert sha(z.read('dropline-four-connect/'+name)) == sha(data)
report = dict(zip=str(archive),sha256=sha(archive.read_bytes()),files=len(files),source_sha256={n:sha(d) for n,d in sorted(files.items())},changed_from_previous_zip=changed,modified_criterion_descriptions=modified,criteria_counts=counts,criterion_weight_totals=weights,all_60_ids_types_weights_preserved=True,public_network_both=True,standard_checks=139,local_groups=passed,formula_cases=12,paid_runs_performed=False,platform_qc_performed=False,oracle_score=None,judge_duration_measured=False,exact_docker_builds_attempted=True,exact_docker_builds_passed=False,cached_image='dropline-verifier-local:v6.0.3')
(out/'package-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='source_sha256'},indent=2))
