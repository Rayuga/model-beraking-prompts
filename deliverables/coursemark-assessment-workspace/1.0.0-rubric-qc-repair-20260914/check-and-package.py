import ast, hashlib, json, math, re, sys, tempfile, tomllib, zipfile
from pathlib import Path

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/coursemark-assessment-workspace'
OLD=OUT/'source-before-repair'
sha=lambda b:hashlib.sha256(b).hexdigest()
parse=lambda p:tomllib.loads(p.read_text(encoding='utf-8'))
oldzip=OUT.parent/'1.0.0-target-040-20260914/coursemark-assessment-workspace.zip'
assert oldzip.is_file()
counts={};preserved={}
renamed={'same_origin_application_shell':'local_authentication_and_course_services','self_contained_entry_and_reload':'public_deployment_health_contract','worksheet_selection_and_conflict_recovery':'worksheet_selection_and_validation','release_review_and_stale_preview_recovery':'release_review_and_selection_feedback'}
for dim in ('render','constraints','functional','polish','visual'):
    now=parse(TASK/f'tests/{dim}/judge.toml')['criterion']
    lookup={c['id']:c for c in now};assert len(lookup)==len(now)
    assert all(re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',c['name']) for c in now)
    if (OLD/f'tests/{dim}/judge.toml').exists():
        prior=parse(OLD/f'tests/{dim}/judge.toml')['criterion']
        for c in prior:
            c={**c,'id':renamed.get(c['id'],c['id'])}
            assert c['id'] in lookup
            for k in ('type','points'):assert c.get(k)==lookup[c['id']].get(k),(dim,c['id'],k)
            assert c['weight']==lookup[c['id']]['weight']
        preserved[dim]=len(prior)
    counts[dim]=len(now)
task=parse(TASK/'task.toml');assert task['environment']['network_mode']==task['verifier']['environment']['network_mode']=='public'
assert task['task']['version']=='1.0.0'
script=(TASK/'tests/test.sh').read_text(encoding='utf-8')
chunks=re.findall(r"<<'PY'\n(.*?)\nPY",script,re.S);assert len(chunks)==5
for chunk in chunks:ast.parse(chunk)
code=compile(chunks[-1],'actual reward postprocessor','exec')
one=dict(render=1,constraints=1,functional=1,polish=1,visual=1)
cases=[('all-one',one,1),('render-zero',{**one,'render':0},0),('constraints-zero',{**one,'constraints':0},0),
 ('partial-positive-gates',dict(render=.1,constraints=.2,functional=.5,polish=.8,visual=.6),.58),
 ('missing',{k:v for k,v in one.items() if k!='visual'},None),('bool',{**one,'render':True},None),
 ('nan',{**one,'functional':math.nan},None),('infinity',{**one,'visual':math.inf},None),
 ('out-of-range',{**one,'functional':1.1},None),('string',{**one,'polish':'1'},None)]
for name,data,expected in cases:
    with tempfile.TemporaryDirectory(prefix='coursemark-reward-') as directory:
        p=Path(directory);f=p/'reward.json';f.write_text(json.dumps(data))
        saved=sys.argv;sys.argv=['reward',str(f),str(p/'reward.txt'),str(p/'ctrf.json')]
        try:
            try:exec(code,{})
            except ValueError:assert expected is None,name
            else:
                assert expected is not None,name
                assert json.loads(f.read_text())['reward']==expected,name
                assert json.loads((p/'ctrf.json').read_text())['summary']['total']==5
        finally:sys.argv=saved
assert (TASK/'tests/coursemark_seed.json').read_bytes()==(TASK/'environment/assets/artifacts/coursemark_seed.json').read_bytes()
assert (TASK/'tests/coursemark_seed.json').read_bytes()==(OLD/'tests/coursemark_seed.json').read_bytes()
for ref in re.findall(r'`(/assets/[^`]+)`',(TASK/'instruction.md').read_text()):assert (TASK/'environment'/ref.lstrip('/')).exists()
provenance=json.loads((OUT/'final-prompt-provenance.json').read_text())
for dim,record in provenance['judges'].items():
    assert sha((TASK/f'tests/{dim}/prompt.md').read_bytes())==record['prompt_sha256']
    assert sha((TASK/f'tests/{dim}/judge.toml').read_bytes())==record['judge_sha256']
regression=json.loads((OUT/'regressions.json').read_text());assert len(regression['results'])==17 and all(r['passed'] for r in regression['results'])
hardening=json.loads((OUT/'hardening.json').read_text());assert len(hardening['results'])==7 and all(r['passed'] for r in hardening['results'])
outcomes=json.loads((OUT/'outcome-regressions.json').read_text());assert len(outcomes['results'])==8 and all(r['passed'] for r in outcomes['results'])
assert json.loads((OUT/'standard-check.json').read_text())['passed']
assert len(json.loads((OUT.parent/'1.0.0-target-040-20260914/visual-review/index.json').read_text())['screenshots'])==34
for p in (TASK/'solution').rglob('*'):
    if p.is_file():assert p.read_bytes()==(OLD/p.relative_to(TASK)).read_bytes()
workflow=json.loads((OUT/'rubric-workflow.json').read_text());assert len(workflow['results'])==3 and all(r['passed'] for r in workflow['results'])
files=sorted(p for p in TASK.rglob('*') if p.is_file());contents={}
for p in files:
    rel=p.relative_to(TASK);assert not p.is_symlink()
    assert not any(part in ('node_modules','.git','__pycache__','reports','deliverables') for part in rel.parts)
    assert p.suffix not in ('.db','.sqlite','.pyc','.log','.zip') and not p.name.startswith('.env')
    text=p.read_text(encoding='utf-8');assert not re.search(r'(?i)(sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}',text)
    if p.suffix in ('.js','.css','.html'):assert not re.search(r'^\s*//|/\*|<!--',text,re.M),str(p)
    if p.suffix in ('.sh','.toml') or p.name=='Dockerfile':assert not re.search(r'^\s*#(?!\!)',text,re.M),str(p)
    contents['coursemark-assessment-workspace/'+rel.as_posix()]=p.read_bytes()
archive=OUT/'coursemark-assessment-workspace.zip';assert not archive.exists()
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
    for name,data in contents.items():
        info=zipfile.ZipInfo(name,date_time=(2026,9,14,0,0,0));info.create_system=3
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
hashes={name:sha(data) for name,data in contents.items()}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    z.extractall(OUT/'packaged-source')
    assert {i.filename.split('/')[0] for i in z.infolist()}=={'coursemark-assessment-workspace'}
    assert {i.filename:sha(z.read(i)) for i in z.infolist()}==hashes
report=dict(zip=str(archive),sha256=sha(archive.read_bytes()),files=len(files),criterion_counts=counts,old_criteria_preserved=preserved,
    public_network_both=True,local_regression_groups=35,renamed_criteria=renamed,golden_implementation_unchanged=True,reward_cases=[dict(name=n,passed=True) for n,_,_ in cases],
    original_zip_sha256=sha(oldzip.read_bytes()),baseline_hashes={p.relative_to(OLD).as_posix():sha(p.read_bytes()) for p in OLD.rglob('*') if p.is_file()},
    source_hashes=hashes,full_image_build_passed=False,paid_runs_performed=False,platform_qc_performed=False)
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('source_hashes','baseline_hashes')},indent=2))
