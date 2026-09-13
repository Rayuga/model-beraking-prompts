from pathlib import Path
import hashlib, json, tomllib, zipfile

OUT=Path(__file__).resolve().parent
TASK=OUT.parents[2]/'projects/brickfall-breaker-arcade'
BASE=OUT.parent/'1.0.0-completed-standard-20260911/brickfall-breaker-arcade.zip'
sha=lambda data:hashlib.sha256(data).hexdigest()
assert sha(BASE.read_bytes())=='471d8f11b260fa9b4e8b33c7574b2da55b701274bee8dafdf1c91601a8ee312a'
with zipfile.ZipFile(BASE) as z:
    old={n.split('/',1)[1]:z.read(n) for n in z.namelist()}
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files)==32 and files.keys()==old.keys()
changed=sorted(n for n in files if files[n]!=old[n])
assert changed==['environment/assets/instructions/checkpoints.md','tests/functional/prompt.md'],changed
counts={d:len(tomllib.loads(files[f'tests/{d}/judge.toml'].decode())['criterion']) for d in ['render','constraints','functional','polish','visual']}
assert counts==dict(render=2,constraints=2,functional=22,polish=5,visual=6)
assert 'Prompt version: brickfall-breaker-arcade-functional-v1.0.0-r2' in files['tests/functional/prompt.md'].decode()
config=tomllib.loads(files['task.toml'].decode())
assert config['task']['version']=='1.0.0'
assert config['environment']['network_mode']==config['verifier']['environment']['network_mode']=='public'
standard=json.loads((OUT/'standard-checks.json').read_text());assert standard['passed']
attempt=OUT/'attempt-1'
runtime=json.loads((attempt/'local-checks.json').read_text());assert runtime['passed']
assert json.loads((attempt/'restart-check.json').read_text())['passed']
groups={}
for name,number in [('gate-regression',5),('step-counter',5),('browser-regression',12),('targeted',8),('coordination',3),('presentation',8)]:
    result=json.loads((attempt/(name+'.json')).read_text())
    if name=='gate-regression':
        assert all(x['passed'] and x['ranked_state_unchanged'] for x in result['results'])
        result['passed']=[x['dimension']+' browser gate' for x in result['results']]
    assert len(result['passed'])==number,(name,result)
    groups[name]=result['passed']
archive=OUT/'brickfall-breaker-arcade.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('brickfall-breaker-arcade/'+name,(2026,9,12,0,0,0))
        info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert all(n.startswith('brickfall-breaker-arcade/') for n in z.namelist())
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()}==files
audit=dict(version='1.0.0',file_count=32,criteria=counts,changed_files=changed,
    standard_checks=len(standard['checks']),local_browser_groups=sum(map(len,groups.values())),
    all_criterion_definitions_weights_types_preserved=True,golden_source_unchanged=True,
    task_toml_dockerfiles_runner_and_reward_unchanged=True,
    agent_network='public',verifier_network='public',zip_sha256=sha(archive.read_bytes()),
    source_archive_hashes_and_crc_verified=True,full_platform_qc=False,full_oracle_run=False,
    files={n:sha(data) for n,data in files.items()})
(OUT/'package-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(OUT/'passed-browser-groups.json').write_text(json.dumps(groups,indent=2)+'\n')
print(json.dumps({k:v for k,v in audit.items() if k!='files'},indent=2))
