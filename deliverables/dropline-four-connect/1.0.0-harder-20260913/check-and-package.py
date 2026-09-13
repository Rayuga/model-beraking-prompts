import ast, hashlib, json, math, re, sys, tempfile, tomllib, zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/dropline-four-connect'
sha = lambda data: hashlib.sha256(data).hexdigest()
read = lambda p: tomllib.loads(p.read_text(encoding='utf-8'))
baseline = json.loads((OUT / 'run-review.json').read_text(encoding='utf-8'))
old = OUT / 'source-before-hardening'
assert {p.relative_to(old).as_posix():sha(p.read_bytes()) for p in old.rglob('*') if p.is_file()} == baseline['source_baseline']
oldzip = ROOT / 'deliverables/dropline-four-connect/1.0.0-name-20260913/dropline-four-connect.zip'
assert sha(oldzip.read_bytes()) == baseline['historical_zip_sha256']
counts, weights, preserved = {}, {}, {}
for dim in ('render','constraints','functional','polish','visual'):
    current = read(TASK/f'tests/{dim}/judge.toml')['criterion']
    previous = read(old/f'tests/{dim}/judge.toml')['criterion']
    lookup = {c['id']:c for c in current}
    assert len(lookup) == len(current)
    for c in previous:
        assert c['id'] in lookup
        assert all(lookup[c['id']].get(k) == c.get(k) for k in ('weight','type','points'))
    counts[dim] = len(current)
    weights[dim] = sum(c['weight'] for c in current)
    preserved[dim] = len(previous)
config = read(TASK/'task.toml')
assert config['environment']['network_mode'] == config['verifier']['environment']['network_mode'] == 'public'
assert config['task']['version'] == '1.0.0'
runner = (TASK/'tests/test.sh').read_text(encoding='utf-8')
chunks = re.findall(r"<<'PY'\n(.*?)\nPY", runner, re.S)
assert len(chunks) == 4
for chunk in chunks: ast.parse(chunk)
code = compile(chunks[-1], 'actual reward post-processing', 'exec')
one = dict(render=1,constraints=1,functional=1,polish=1,visual=1)
cases = [('all-one',one,1),('render-zero',{**one,'render':0},0),('constraints-zero',{**one,'constraints':0},0),
 ('partial-positive-gates',dict(render=.1,constraints=.2,functional=.5,polish=.8,visual=.6),.58),
 ('missing-visual',{k:v for k,v in one.items() if k!='visual'},None),('bool',{**one,'render':True},None),
 ('nan',{**one,'functional':math.nan},None),('infinity',{**one,'visual':math.inf},None),
 ('out-of-range',{**one,'functional':1.1},None),('string',{**one,'polish':'1'},None)]
for name,data,expected in cases:
    with tempfile.TemporaryDirectory(prefix='dropline-formula-') as folder:
        temp=Path(folder); source=temp/'reward.json'; source.write_text(json.dumps(data))
        saved=sys.argv; sys.argv=['reward',str(source),str(temp/'reward.txt'),str(temp/'ctrf.json')]
        try:
            try: exec(code,{})
            except ValueError: assert expected is None,name
            else:
                assert expected is not None,name
                assert json.loads(source.read_text())['reward'] == expected,name
                assert json.loads((temp/'ctrf.json').read_text())['summary']['total'] == 5
        finally: sys.argv=saved
assert (TASK/'environment/assets/artifacts/dropline_seed.xlsx').read_bytes() == (TASK/'tests/assets/artifacts/dropline_seed.xlsx').read_bytes()
files=sorted(p for p in TASK.rglob('*') if p.is_file())
hashes={}
for p in files:
    rel=p.relative_to(TASK)
    assert not p.is_symlink()
    assert not any(part in ('node_modules','__pycache__','.git','reports','deliverables') for part in rel.parts)
    assert p.suffix not in ('.db','.sqlite','.pyc','.log','.zip')
    assert not p.name.startswith('.env')
    if p.suffix == '.toml':read(p)
    if p.suffix != '.xlsx':
        text=p.read_text(encoding='utf-8')
        assert not re.search(r'(?i)(?:sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}',text)
        assert '\r' not in text, str(p)
    hashes['dropline-four-connect/'+rel.as_posix()]=sha(p.read_bytes())
for p in [TASK/'environment/Dockerfile',TASK/'tests/Dockerfile',TASK/'tests/test.sh']:
    assert not re.search('OPENAI_API_KEY|OPENROUTER_API_KEY',p.read_text())
regressions=json.loads((OUT/'regressions.json').read_text())
assert len(regressions['results']) == 27 and all(c['passed'] for c in regressions['results'])
provenance=json.loads((OUT/'runner-logs/prompt-provenance.json').read_text())
for dim, recorded in provenance['judges'].items():
    assert sha((TASK/f'tests/{dim}/prompt.md').read_bytes()) == recorded['prompt_sha256']
    assert sha((TASK/f'tests/{dim}/judge.toml').read_bytes()) == recorded['judge_sha256']
archive=OUT/'dropline-four-connect.zip'
assert not archive.exists(), 'Preserve existing delivery; use a new folder for another release'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
    for p in files:
        name='dropline-four-connect/'+p.relative_to(TASK).as_posix()
        info=zipfile.ZipInfo(name,date_time=(2026,9,13,0,0,0));info.create_system=3
        info.external_attr=(0o100755 if p.suffix=='.sh' else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {i.filename.split('/')[0] for i in z.infolist()} == {'dropline-four-connect'}
    assert {i.filename:sha(z.read(i)) for i in z.infolist()} == hashes
report=dict(zip=str(archive),zip_sha256=sha(archive.read_bytes()),files=len(files),source_hashes=hashes,
    counts=counts,criterion_weight_sums=weights,old_criteria_preserved=preserved,public_network_both=True,
    baseline_source_and_zip_unchanged=True,reward_cases=[dict(name=n,passed=True) for n,_,_ in cases],
    local_regression_groups=len(regressions['results']),paid_oracle_run=False,platform_qc_run=False)
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='source_hashes'},indent=2))
