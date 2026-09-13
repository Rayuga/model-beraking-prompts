from pathlib import Path
import hashlib, importlib.util, json, re, subprocess, tomllib, zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/brickfall-breaker-arcade'
spec=importlib.util.spec_from_file_location('standard',ROOT/'references/task-templates/check-standard.py')
standard=importlib.util.module_from_spec(spec);spec.loader.exec_module(standard)
checks=standard.validate(TASK)
(OUT/'standard-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files)==32,len(files)
assert not any(any(part in {'node_modules','.git','__pycache__','.cache'} for part in Path(n).parts) or n.endswith(('.db','.log','.pyc','.zip')) or Path(n).name.startswith('.env') for n in files)
baseline=OUT.parent/'1.0.0-reference-standard/before-reference-standard.zip'
with zipfile.ZipFile(baseline) as z:
    old={n.split('/',1)[1]:z.read(n) for n in z.namelist() if not n.endswith('/')}
for n in ['instruction.md','solution/app/server.js','solution/solve.sh']+[n for n in files if n.startswith('environment/assets/')]:
    assert files[n]==old[n],'Unexpected change: '+n
path='solution/app/public/index.html'
a=old[path].decode();b=files[path].decode()
new_css='''      .overlay { padding: 8px; }
      .overlay-card { max-height: 100%; overflow: auto; padding: 10px 14px; }
      .overlay-card h2 { margin-bottom: 6px; font-size: 1.25rem; line-height: 1.2; }
      .overlay-card p { margin-bottom: 6px; font-size: .82rem; line-height: 1.35; }'''
assert b.replace(new_css,'      .overlay-card { padding: 18px 14px; }')==a,'Unexpected golden client change'
assert a.split('<script>')[1]==b.split('<script>')[1]
for d in ('render','constraints','functional'):
    n=f'tests/{d}/judge.toml'
    assert tomllib.loads(files[n].decode())['criterion']==tomllib.loads(old[n].decode())['criterion'],d+' criteria changed'
for name in ('brickfall_seed.xlsx','brickfall_scenarios.json'):
    assert files['tests/'+name]==files['environment/assets/artifacts/'+name]
cfg=tomllib.loads(files['task.toml'].decode())
assert cfg['task']['version']=='1.0.0'
assert cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public'
assert cfg['verifier']['env']['REWARDKIT_MODEL']=='gpt-5.6-luna'
assert cfg['verifier']['env']['REWARDKIT_REASONING_EFFORT']=='max'
attempt=OUT/'attempt-6'
runtime=json.loads((attempt/'local-checks.json').read_text());assert runtime['passed']
assert json.loads((attempt/'restart-check.json').read_text())['passed']
groups={}
for name,count in [('gate-regression',5),('browser-regression',12),('targeted',8),('coordination',3),('presentation',8)]:
    data=json.loads((attempt/(name+'.json')).read_text())
    if name=='gate-regression':
        assert all(item['passed'] and item['ranked_state_unchanged'] for item in data['results'])
        data['passed']=[item['dimension']+' authenticated browser gate' for item in data['results']]
    assert len(data['passed'])==count,(name,data)
    groups[name]=data['passed']
archive=OUT/'brickfall-breaker-arcade.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('brickfall-breaker-arcade/'+name,(2026,9,12,0,0,0))
        info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
sha=lambda data:hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==32 and all(n.startswith('brickfall-breaker-arcade/') for n in z.namelist())
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()}==files
report=dict(version='1.0.0',name='brickfall-breaker-arcade',file_count=len(files),criteria=checks['counts'],
    standard_checks=len(checks['checks']),agent_network='public',verifier_network='public',
    original_22_functional_criteria_preserved=True,original_render_constraints_preserved=True,
    original_instructions_and_seed_preserved=True,golden_server_and_gameplay_js_unchanged=True,
    golden_css_change='Compact mobile overlay to keep Launch action inside the canvas stage',
    local_browser_groups=sum(map(len,groups.values())),reward_math_cases=runtime['reward_cases'],
    invalid_scores_rejected=runtime['invalid_scores_rejected'],restart_all_tables_preserved=True,
    exact_docker_builds_passed=False,full_platform_qc=False,full_oracle_run=False,
    archive_source_hashes_and_crc_verified=True,zip_sha256=sha(archive.read_bytes()),
    files={n:sha(data) for n,data in files.items()})
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'passed-browser-groups.json').write_text(json.dumps(groups,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
