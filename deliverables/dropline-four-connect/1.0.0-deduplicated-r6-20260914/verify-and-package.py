import hashlib
import json
from pathlib import Path
import re
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
source = root / 'projects/dropline-four-connect'
prior = out.parent / '1.0.0-execution-r5-20260914/dropline-four-connect.zip'
sha = lambda data: hashlib.sha256(data).hexdigest()
files = {p.relative_to(source).as_posix(): p.read_bytes() for p in source.rglob('*') if p.is_file()}
assert len(files) == 39
assert not any(p.is_symlink() for p in source.rglob('*'))
with zipfile.ZipFile(prior) as z:
    old = {n.removeprefix('dropline-four-connect/'): z.read(n) for n in z.namelist()}
assert files.keys() == old.keys()
changed = sorted(n for n in files if files[n] != old[n])
assert changed == ['tests/functional/judge.toml', 'tests/functional/prompt.md', 'tests/render/judge.toml', 'tests/render/prompt.md'], changed
for name, data in files.items():
    assert name.split('/')[0] in {'environment', 'solution', 'tests', 'instruction.md', 'task.toml'}
    assert not any(p in {'node_modules', '__pycache__', '.git', '.cache'} for p in Path(name).parts)
    assert not re.search(r'\.(db|sqlite|sqlite3|pyc|zip|log)$|(^|/)\.env', name)
    if name.endswith('.toml'):
        tomllib.loads(data.decode())
    if name.endswith('.json'):
        json.loads(data)
    if name.endswith('.sh'):
        assert b'\r\n' not in data
    if name.endswith(('.md','.toml','.js','.css','.html','.sh')) or name.endswith('Dockerfile'):
        assert not re.search(r'\b(TODO|FIXME)\b|sk-proj-[A-Za-z0-9_-]{12,}|sk-or-v1-[A-Za-z0-9_-]{12,}', data.decode())
cfg = tomllib.loads(files['task.toml'].decode())
assert cfg['task']['version'] == '1.0.0'
assert cfg['task']['name'] == 'turing/dropline-four-connect'
assert cfg['environment']['network_mode'] == cfg['verifier']['environment']['network_mode'] == 'public'
assert cfg['verifier']['env'] == dict(OPENAI_API_KEY='${OPENAI_API_KEY}',REWARDKIT_JUDGE='codex',REWARDKIT_MODEL='gpt-5.6-luna',REWARDKIT_REASONING_EFFORT='max')
for name in ['environment/Dockerfile','tests/Dockerfile','tests/test.sh']:
    assert not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY',files[name].decode())
dims = ['render','constraints','functional','polish','visual']
counts, totals, removed, modified = {}, {}, {}, []
provenance = json.loads((out/'runner-logs/prompt-provenance.json').read_text())
for dim in dims:
    key = f'tests/{dim}/judge.toml'
    now, before = (tomllib.loads(d[key].decode()) for d in (files,old))
    assert now['judge'] == before['judge'] and now['scoring'] == before['scoring']
    current = {c['id']:c for c in now['criterion']}
    previous = {c['id']:c for c in before['criterion']}
    assert current.keys() <= previous.keys()
    removed[dim] = sorted(previous.keys()-current.keys())
    for cid, criterion in current.items():
        assert {k:v for k,v in criterion.items() if k!='description'} == {k:v for k,v in previous[cid].items() if k!='description'}
        if criterion['description'] != previous[cid]['description']:
            modified.append(cid)
    counts[dim] = len(current)
    totals[dim] = sum(c['weight'] for c in current.values())
    for filename,key in [('judge.toml','judge_sha256'),('prompt.md','prompt_sha256')]:
        assert sha(files[f'tests/{dim}/{filename}']) == provenance['judges'][dim][key], (dim,key)
assert removed == dict(render=['basic_control_and_game_surface'],constraints=[],functional=['authenticated_account_workflow'],polish=[],visual=[])
assert counts == dict(render=1,constraints=2,functional=42,polish=7,visual=6)
assert totals['functional'] == 65.5
assert sha(files['tests/test.sh']) == provenance['runner_sha256']
assert sha(files['tests/reward.toml']) == provenance['reward_config_sha256']
passed = {}
for name,count in [('regressions.json',49),('shared-journeys.json',4)]:
    results = json.loads((out/name).read_text())['results']
    assert len(results)==count and all(r['passed'] for r in results)
    passed[name]=count
pointer = json.loads((out/'pointer-boundary.json').read_text())
assert len(pointer)==1 and pointer[0]['passed']
passed['pointer-boundary.json']=1
standard = json.loads((out/'standard-check.json').read_text())
assert standard['passed']
archive=out/'dropline-four-connect.zip'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('dropline-four-connect/'+name,(2026,9,14,0,0,0))
        info.create_system=3
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(files)
    assert {n.split('/')[0] for n in z.namelist()}=={'dropline-four-connect'}
    for name,data in files.items():
        assert sha(z.read('dropline-four-connect/'+name))==sha(data)
report=dict(zip=str(archive),sha256=sha(archive.read_bytes()),files=len(files),source_sha256={n:sha(d) for n,d in sorted(files.items())},changed_from_r5=changed,removed_criteria=removed,modified_criteria=modified,counts=counts,weight_totals=totals,remaining_ids_types_weights_preserved=True,all_product_instructions_and_golden_files_unchanged=True,public_network_both=True,standard_checks=len(standard['checks']),fresh_local_groups=passed,cached_image='dropline-verifier-local:v6.0.3',fresh_docker_build=False,paid_run=False,platform_qc=False,oracle_score=None,judge_duration_measured=False)
(out/'package-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='source_sha256'},indent=2))
