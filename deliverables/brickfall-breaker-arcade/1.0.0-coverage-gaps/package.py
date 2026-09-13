from pathlib import Path
import hashlib,json,tomllib,zipfile

OUT=Path(__file__).resolve().parent;TASK=OUT.parents[2]/'projects/brickfall-breaker-arcade'
BASE=OUT.parent/'1.0.0-visible-step-counter/brickfall-breaker-arcade.zip'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(BASE.read_bytes())=='5de079045f898aff9357c77cf00b6b0b357943eb1cf33a208fce5e4a421a41e6'
with zipfile.ZipFile(BASE) as z:old={n.split('/',1)[1]:z.read(n) for n in z.namelist()}
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert files.keys()==old.keys() and len(files)==32
changed=sorted(n for n in files if files[n]!=old[n])
assert changed==sorted(['environment/assets/artifacts/brickfall_scenarios.json','tests/brickfall_scenarios.json','solution/app/server.js','task.toml','tests/functional/judge.toml','tests/functional/prompt.md']),changed
assert files['environment/assets/artifacts/brickfall_scenarios.json']==files['tests/brickfall_scenarios.json']
assert files['solution/app/server.js'].decode().replace('    state.bricks.push(customBrick("final-solid", "solid", 99, 20));\n','')==old['solution/app/server.js'].decode()
before=tomllib.loads(old['tests/functional/judge.toml'].decode());after=tomllib.loads(files['tests/functional/judge.toml'].decode())
assert after['criterion'][:22]==before['criterion']
assert [c['id'] for c in after['criterion'][22:]]==['solid_bricks_do_not_block_completion','bearer_identity_overrides_client_claims','terminal_score_increases_best']
assert all(c['weight']==1.0 and c['type']=='binary' for c in after['criterion'][22:])
assert after['judge']==before['judge'] and after['scoring']==before['scoring']
cfg=tomllib.loads(files['task.toml'].decode());previous=tomllib.loads(old['task.toml'].decode())
previous['metadata']['difficulty_explanation']=cfg['metadata']['difficulty_explanation'];assert previous==cfg
assert cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public'
standard=json.loads((OUT/'standard-checks.json').read_text());assert standard['passed']
attempt=OUT/'attempt-1';assert json.loads((attempt/'local-checks.json').read_text())['passed']
assert json.loads((attempt/'restart-check.json').read_text())['passed']
groups={}
for name,count in [('gate-regression',5),('step-counter',5),('browser-regression',12),('targeted',8),('coordination',3),('presentation',8),('coverage',3)]:
    data=json.loads((attempt/(name+'.json')).read_text())
    if name=='gate-regression':
        assert all(x['passed'] for x in data['results']);data['passed']=[x['dimension'] for x in data['results']]
    assert len(data['passed'])==count,(name,data)
    groups[name]=data['passed']
archive=OUT/'brickfall-breaker-arcade.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('brickfall-breaker-arcade/'+name,(2026,9,12,0,0,0));info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16;z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert all(n.startswith('brickfall-breaker-arcade/') for n in z.namelist())
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()}==files
audit=dict(version='1.0.0',criteria=standard['counts'],file_count=32,changed_files=changed,
    original_37_criteria_preserved=True,added_functional_criteria=3,added_weights=[1,1,1],
    final_dimension_weights_unchanged=True,gameplay_js_unchanged=True,
    golden_server_change='Add one solid brick to Final wall fixture only',
    standard_checks=len(standard['checks']),browser_groups=sum(map(len,groups.values())),
    agent_network='public',verifier_network='public',zip_sha256=sha(archive.read_bytes()),
    archive_crc_and_source_hashes_verified=True,full_platform_qc=False,full_oracle_run=False,
    files={n:sha(data) for n,data in files.items()})
(OUT/'package-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
(OUT/'passed-browser-groups.json').write_text(json.dumps(groups,indent=2)+'\n')
print(json.dumps({k:v for k,v in audit.items() if k!='files'},indent=2))
