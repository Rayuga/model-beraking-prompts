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
baseline = out / 'source-before-features'
sha = lambda data: hashlib.sha256(data).hexdigest()
files = {p.relative_to(source).as_posix(): p.read_bytes() for p in source.rglob('*') if p.is_file()}
assert len(files) == 39, len(files)
assert not any(p.is_symlink() for p in source.rglob('*'))
for name, data in files.items():
    assert not any(part in {'node_modules', '__pycache__', '.git', '.cache'} for part in Path(name).parts)
    assert not re.search(r'\.(db|sqlite|sqlite3|pyc|zip|log)$|(^|/)\.env', name)
    if name.endswith('.toml'):
        tomllib.loads(data.decode('utf-8'))
    if name.endswith('.json'):
        json.loads(data)
    if name.endswith('.sh'):
        assert b'\r\n' not in data
    if name.endswith(('.md', '.toml', '.js', '.css', '.html', '.sh')) or name.endswith('Dockerfile'):
        text = data.decode('utf-8')
        assert not re.search(r'\b(TODO|FIXME)\b|sk-proj-[A-Za-z0-9_-]{12,}|sk-or-v1-[A-Za-z0-9_-]{12,}', text)

cfg = tomllib.loads(files['task.toml'].decode())
oldcfg = tomllib.loads((baseline / 'task.toml').read_text())
assert cfg['task']['version'] == '1.0.0'
assert cfg['task']['name'] == 'turing/dropline-four-connect'
for key in ['schema_version', 'artifacts', 'agent', 'environment', 'verifier']:
    assert cfg[key] == oldcfg[key], key
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
assert cfg['verifier']['env'] == dict(OPENAI_API_KEY='${OPENAI_API_KEY}', REWARDKIT_JUDGE='codex', REWARDKIT_MODEL='gpt-5.6-luna', REWARDKIT_REASONING_EFFORT='max')
for name in ['environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh', 'tests/reward.toml', 'tests/app-lifecycle.sh']:
    assert files[name] == (baseline / name).read_bytes(), name
for name in ['environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh']:
    assert not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY', files[name].decode())

dimensions = ['render', 'constraints', 'functional', 'polish', 'visual']
counts, weights, added, preserved = {}, {}, {}, 0
provenance = json.loads((out / 'runner-logs/prompt-provenance.json').read_text())
for dim in dimensions:
    path = f'tests/{dim}/judge.toml'
    current = tomllib.loads(files[path].decode())
    previous = tomllib.loads((baseline / path).read_text())
    old = {c['id']: c for c in previous['criterion']}
    now = {c['id']: c for c in current['criterion']}
    assert len(now) == len(current['criterion'])
    for cid, criterion in old.items():
        assert cid in now and all(criterion[k] == now[cid][k] for k in ['type', 'weight']), (dim, cid)
    assert current['judge'] == previous['judge'], dim
    assert 'judge' not in current['judge'] and 'model' not in current['judge']
    counts[dim] = len(now)
    weights[dim] = sum(c['weight'] for c in now.values())
    added[dim] = {cid: now[cid]['weight'] for cid in now.keys() - old.keys()}
    preserved += len(old)
    for filename, key in [('judge.toml', 'judge_sha256'), ('prompt.md', 'prompt_sha256')]:
        assert sha(files[f'tests/{dim}/{filename}']) == provenance['judges'][dim][key], (dim, filename)
assert counts == dict(render=2, constraints=2, functional=43, polish=7, visual=6)
assert preserved == 42
assert sha(files['tests/test.sh']) == provenance['runner_sha256']
assert sha(files['tests/reward.toml']) == provenance['reward_config_sha256']
for data in [files['instruction.md'], files['environment/assets/instructions/overview.md']]:
    for path in re.findall(r'/assets/instructions/([a-z-]+\.md)', data.decode()):
        assert f'environment/assets/instructions/{path}' in files

regressions = json.loads((out / 'regressions.json').read_text())['results']
assert len(regressions) == 49 and all(t['passed'] for t in regressions)
layouts = json.loads((out / 'visual-regressions.json').read_text())['results']
assert len(layouts) == 3 and all(t['passed'] for t in layouts)
standard = json.loads((out / 'standard-check.json').read_text())
assert standard['passed'] is True and len(standard['checks']) == 139
assert len(json.loads((out / 'tactical-fixtures.json').read_text())) == 12

runner = files['tests/test.sh'].decode()
script = re.search(r'if ! python3 - "\$LOG_DIR/reward.json"[^\n]*<<\x27PY\x27\n(.*?)\nPY', runner, re.S).group(1)
valid = dict(render=1, constraints=1, functional=.5, polish=.8, visual=.6)
cases = [('weighted', valid, .58), ('render gate', {**valid, 'render': 0}, 0), ('constraints gate', {**valid, 'constraints': 0}, 0), ('perfect', dict.fromkeys(dimensions, 1), 1), ('zero', dict.fromkeys(dimensions, 0), 0)]
cases.extend((name, {**valid, 'functional': value}, None) for name, value in [('boolean', True), ('string', '.5'), ('null', None), ('negative', -.1), ('above one', 1.1), ('NaN', float('nan'))])
cases.append(('missing', {k: v for k, v in valid.items() if k != 'functional'}, None))
formula_results = []
with tempfile.TemporaryDirectory(prefix='dropline-formula-') as temp:
    folder = Path(temp)
    for name, data, expected in cases:
        inputfile = folder / 'reward.json'
        inputfile.write_text(json.dumps(data))
        proc = subprocess.run([sys.executable, '-c', script, str(inputfile), str(folder/'reward.txt'), str(folder/'ctrf.json')], capture_output=True, text=True)
        if expected is None:
            assert proc.returncode != 0, name
        else:
            assert proc.returncode == 0, proc.stderr
            assert json.loads(inputfile.read_text())['reward'] == expected
            assert json.loads((folder/'ctrf.json').read_text())['summary']['total'] == 5
        formula_results.append(dict(name=name, passed=True))
(out / 'reward-formula-checks.json').write_text(json.dumps(formula_results, indent=2))

archive = out / 'dropline-four-connect.zip'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED) as z:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo('dropline-four-connect/' + name, (2026, 9, 14, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        z.writestr(info, data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(files)
    assert {n.split('/')[0] for n in z.namelist()} == {'dropline-four-connect'}
    for name, data in files.items():
        assert sha(z.read('dropline-four-connect/' + name)) == sha(data)
report = dict(zip=str(archive), sha256=sha(archive.read_bytes()), files=len(files), wrapper='dropline-four-connect', source_sha256={n:sha(d) for n,d in sorted(files.items())}, changed_from_pre_features=[n for n,d in files.items() if not (baseline/n).exists() or (baseline/n).read_bytes()!=d], criteria_counts=counts, criteria_weight_totals=weights, preserved_criterion_ids_types_weights=preserved, new_criteria=added, local_regressions_passed=len(regressions), local_layout_groups_passed=len(layouts), formula_cases_passed=len(formula_results), standard_checks_passed=len(standard['checks']), public_network_both=True, current_verifier_provenance_matches=True, paid_runs_performed=False, platform_qc_performed=False, oracle_score=None, model_score=None, exact_docker_builds_passed=False, docker_notes='Agent build cancelled after Debian repository stalled; verifier build failed after repeated PyPI read timeouts. Regressions used cached dropline-verifier-local:v6.0.3 with a Chromium path symlink, current source, real solve.sh and test.sh, and an unpaid RewardKit stand-in.')
(out / 'package-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['source_sha256', 'new_criteria']}, indent=2))
