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

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
TASK=ROOT/'projects/pellmoor-job-pipeline'
OLD=OUT/'source-before-standard'
sha=lambda data:hashlib.sha256(data).hexdigest()
read=lambda path:path.read_text(encoding='utf-8')
baseline=json.loads(read(OUT/'migration.json'))
assert {p.relative_to(OLD).as_posix():sha(p.read_bytes()) for p in OLD.rglob('*') if p.is_file()}==baseline['source_hashes']
task=tomllib.loads(read(TASK/'task.toml'))
assert task['task']['name']=='turing/pellmoor-job-pipeline'
assert task['task']['version']=='1.0.0'
assert task['environment']['network_mode']==task['verifier']['environment']['network_mode']=='public'
script=read(TASK/'tests/test.sh')
for p in [TASK/'tests/test.sh',TASK/'tests/Dockerfile',TASK/'environment/Dockerfile']:
    assert not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY',read(p))
chunks=re.findall(r"<<'PY'\n(.*?)\nPY",script,re.S)
assert len(chunks)==4
for chunk in chunks:ast.parse(chunk)
code=compile(chunks[-1],str(TASK/'tests/test.sh')+':reward-postprocess','exec')
base=dict(render=1,constraints=1,functional=1,polish=1,visual=1)
cases=[
 ('all-one',base,1),
 ('render-zero',{**base,'render':0},0),
 ('constraints-zero',{**base,'constraints':0},0),
 ('positive-partial-gates',dict(render=.1,constraints=.2,functional=.5,polish=.8,visual=.6),.58),
 ('missing-visual',{k:v for k,v in base.items() if k!='visual'},None),
 ('boolean',{**base,'render':True},None),
 ('nan',{**base,'functional':math.nan},None),
 ('infinity',{**base,'visual':math.inf},None),
 ('out-of-range',{**base,'functional':1.1},None),
 ('string',{**base,'functional':'1'},None),
]
checks=[]
for name,values,expected in cases:
    with tempfile.TemporaryDirectory(prefix='pellmoor-reward-') as temporary:
        temp=Path(temporary);source=temp/'reward.json';source.write_text(json.dumps(values))
        saved=sys.argv;sys.argv=['reward',str(source),str(temp/'reward.txt'),str(temp/'ctrf.json')]
        try:
            try:exec(code,{})
            except ValueError:assert expected is None,name
            else:
                assert expected is not None,name
                assert json.loads(read(source))['reward']==expected,name
                assert json.loads(read(temp/'ctrf.json'))['summary']['total']==5
        finally:sys.argv=saved
    checks.append({'name':name,'passed':True})

old_criteria={}
new_criteria={}
for dim in ('render','constraints','functional','polish','visual'):
    parsed=tomllib.loads(read(TASK/f'tests/{dim}/judge.toml'))
    assert 'judge' not in parsed['judge'] and 'model' not in parsed['judge']
    for c in parsed['criterion']:
        assert c['id'] not in new_criteria
        new_criteria[c['id']]={'dimension':dim,'weight':c['weight']}
    if dim!='visual':
        for c in tomllib.loads(read(OLD/f'tests/{dim}/judge.toml'))['criterion']:
            old_criteria[c['id']]={'dimension':dim,'weight':c['weight']}
for cid,c in old_criteria.items():
    assert cid in new_criteria,cid
    assert c['weight']==new_criteria[cid]['weight'],cid
coverage={'all_legacy_ids_and_weights_preserved':True,'legacy_count':len(old_criteria),'current_count':len(new_criteria),'old':old_criteria,'new':new_criteria,'additions':sorted(set(new_criteria)-set(old_criteria))}
(OUT/'coverage-preservation.json').write_text(json.dumps(coverage,indent=2)+'\n')
assert read(TASK/'tests/functional/judge.toml').count('/tests/app-lifecycle.sh restart')==1
assert sum(p.name=='app-lifecycle.sh' for p in TASK.rglob('*'))==1
assert (TASK/'environment/assets/recruitment/records/pellmoor_seed_data.json').read_bytes()==(TASK/'tests/pellmoor_seed_data.json').read_bytes()
assert json.loads(read(TASK/'tests/pellmoor_seed_data.json'))==json.loads(read(OLD/'tests/pellmoor_seed_data.json'))
assert json.loads(read(OUT/'regressions.json'))['results'][-1]['status']=='passed'
assert all(x['status']=='passed' for x in json.loads(read(OUT/'regressions.json'))['results'])
assert all(x['passed'] for x in json.loads(read(OUT/'edge-regressions.json'))['findings'])
files=sorted(p for p in TASK.rglob('*') if p.is_file())
for p in files:
    rel=p.relative_to(TASK)
    assert not p.is_symlink()
    assert not any(part in ('node_modules','__pycache__','.git','reports') for part in rel.parts)
    assert p.suffix not in ('.db','.sqlite','.pyc','.log','.zip')
    assert not p.name.startswith('.env')
    if p.suffix=='.toml':tomllib.loads(read(p))
    assert b'\r\n' not in p.read_bytes(),str(rel)
    assert not re.search(r'(?i)(?:sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}',read(p))
    assert 'dropline' not in read(p).lower(),str(rel)
    assert '2.0.12' not in read(p),str(rel)
archive=OUT/'pellmoor-job-pipeline.zip'
assert not archive.exists(),'Do not overwrite a delivered ZIP'
hashes={}
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for p in files:
        name='pellmoor-job-pipeline/'+p.relative_to(TASK).as_posix();data=p.read_bytes()
        info=zipfile.ZipInfo(name,date_time=(2026,9,13,0,0,0));info.create_system=3
        info.external_attr=(0o100755 if p.suffix=='.sh' else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data);hashes[name]=sha(data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {i.filename.split('/')[0] for i in z.infolist()}=={'pellmoor-job-pipeline'}
    assert {i.filename:sha(z.read(i)) for i in z.infolist()}==hashes
result=dict(original_snapshot_unchanged=True,public_network_both=True,source_file_count=len(files),source_hashes=hashes,zip_sha256=sha(archive.read_bytes()),reward_cases=checks)
(OUT/'package-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(zip=str(archive),sha256=result['zip_sha256'],files=len(files),reward_cases=len(checks),criteria=len(new_criteria),legacy_criteria_preserved=len(old_criteria)),indent=2))
