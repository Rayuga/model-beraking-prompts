from pathlib import Path
import ast, hashlib, json, math, re, sys, tempfile, tomllib, zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/pellmoor-job-pipeline'
sha=lambda b:hashlib.sha256(b).hexdigest()
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files)==32
assert {p.split('/')[0] for p in files}=={'task.toml','instruction.md','solution','environment','tests'}
assert files['tests/pellmoor_seed_data.json']==files['environment/assets/recruitment/records/pellmoor_seed_data.json']
for name,data in files.items():
    assert b'\r\n' not in data,name
    assert not re.search(rb'(?:sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}',data),name
    assert not any(p in ('.git','node_modules','__pycache__','reports') for p in Path(name).parts)
    assert Path(name).suffix not in ('.db','.sqlite','.zip','.log','.pyc')
    if name.endswith('.toml'):tomllib.loads(data.decode())
    if name.endswith(('.js','.ts','.html')):
        assert not re.search(rb'^\s*(?://|/\*|<!--)',data,re.M),name
    if name.endswith(('.toml','.sh')) or name.endswith('Dockerfile'):
        assert not re.search(rb'^\s*#(?!\!)',data,re.M),name
baseline=json.loads((OUT/'baseline-hashes.json').read_text())
assert sha(files['tests/pellmoor_seed_data.json'])==baseline['tests/pellmoor_seed_data.json']
for dim in ('render','constraints','functional','polish','visual'):
    old=tomllib.loads((OUT/f'source-before-batch/tests/{dim}/judge.toml').read_text())
    new=tomllib.loads(files[f'tests/{dim}/judge.toml'].decode())
    assert old['judge']==new['judge']
    old_ids={c['id'] for c in old['criterion']}
    assert [(c['id'],c['weight'],c['type'],c.get('points')) for c in old['criterion']]==[(c['id'],c['weight'],c['type'],c.get('points')) for c in new['criterion'] if c['id'] in old_ids]
assert json.loads((OUT/'standard-qc.json').read_text())['passed']
for name in ('regressions.json','hardening-regressions.json','batch-regressions.json'):
    assert all(x['status']=='passed' for x in json.loads((OUT/name).read_text())['results'])
assert json.loads((OUT/'gate-regression.json').read_text())['passed']
mutants=json.loads((OUT/'mutation-controls.json').read_text())['results']
assert len(mutants)==7 and all(x['golden_passed'] and x['mutant_detected'] for x in mutants)
visual=json.loads((OUT/'visual-regressions.json').read_text())['results']
assert len(visual)==6 and all('error' not in x and x['funnel_text_within_svg'] for x in visual)
runner_provenance=json.loads((OUT/'runner-logs/prompt-provenance.json').read_text())
assert runner_provenance['runner_sha256']==sha(files['tests/test.sh'])
for dim,data in runner_provenance['judges'].items():
    assert data['judge_sha256']==sha(files[f'tests/{dim}/judge.toml'])
    assert data['prompt_sha256']==sha(files[f'tests/{dim}/prompt.md'])
chunks=re.findall(r"<<'PY'\n(.*?)\nPY",files['tests/test.sh'].decode(),re.S)
assert len(chunks)==4
for c in chunks:ast.parse(c)
code=compile(chunks[-1],'reward-postprocess','exec')
base=dict(render=1,constraints=1,functional=1,polish=1,visual=1)
cases=[('all-one',base,1),('render-zero',{**base,'render':0},0),('constraints-zero',{**base,'constraints':0},0),('partial-positive-gates',dict(render=.1,constraints=.2,functional=.5,polish=.8,visual=.6),.58),('missing',{k:v for k,v in base.items() if k!='visual'},None),('boolean',{**base,'render':True},None),('nan',{**base,'functional':math.nan},None),('infinity',{**base,'visual':math.inf},None),('high-range',{**base,'functional':1.1},None),('negative-range',{**base,'polish':-.1},None),('string',{**base,'functional':'1'},None)]
for name,values,expected in cases:
    with tempfile.TemporaryDirectory(prefix='pellmoor-postrun-') as temporary:
        temp=Path(temporary);source=temp/'reward.json';source.write_text(json.dumps(values));saved=sys.argv
        sys.argv=['reward',str(source),str(temp/'reward.txt'),str(temp/'ctrf.json')]
        try:
            try:exec(code,{})
            except ValueError:assert expected is None,name
            else:
                assert expected is not None,name
                assert json.loads(source.read_text())['reward']==expected,name
        finally:sys.argv=saved
archive=OUT/'pellmoor-job-pipeline.zip'
assert not archive.exists(),'Preserve the already frozen ZIP'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('pellmoor-job-pipeline/'+name,(2026,9,14,0,0,0))
        info.create_system=3;info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16;info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()}==files
report=dict(status='Review candidate; full exact-image and platform evaluation pending',zip_sha256=sha(archive.read_bytes()),files=len(files),standard_checks=139,reward_matrix_cases=len(cases),existing_criterion_ids_and_weights_unchanged=True,new_functional_criteria=8,total_criteria=60,source_sha256={n:sha(b) for n,b in sorted(files.items())},changed_files=[n for n,b in sorted(files.items()) if sha(b)!=baseline[n]],golden_local_checks_image='pellmoor-tests:2.0.3',paid_oracle_or_target_run=False,platform_qc=False)
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('source_sha256','changed_files')},indent=2))
