from pathlib import Path
import hashlib, importlib.util, json, re, tomllib, zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/gambit-hollow-cribbage'
WRAPPER=TASK.name+'/'
BASE=OUT.parent/'1.0.0-runtime-fairness-fix-20260914/gambit-hollow-cribbage.zip'

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

with zipfile.ZipFile(BASE) as z:
    before={n.removeprefix(WRAPPER):z.read(n) for n in z.namelist()}
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert not (before.keys()-files.keys())
assert files.keys()-before.keys()=={'environment/assets/club/recovery.md','tests/assets/club/recovery.md'}
for name in ('task.toml','environment/Dockerfile','tests/Dockerfile','tests/test.sh','tests/app-lifecycle.sh','tests/reward.toml'):
    assert files[name]==before[name],name
for d in ('render','constraints','functional','polish','visual'):
    old=tomllib.loads(before[f'tests/{d}/judge.toml'].decode())
    new=tomllib.loads(files[f'tests/{d}/judge.toml'].decode())
    assert old['judge']==new['judge'] and old['scoring']==new['scoring']
    for c in old['criterion']:
        after=next(a for a in new['criterion'] if a['id']==c['id'])
        assert {k:v for k,v in c.items() if k!='description'}=={k:v for k,v in after.items() if k!='description'}
for n,data in files.items():
    assert not n.endswith(('.db','.zip','.png','.log','.pyc'))
    if n.endswith(('.js','.sh','.toml','.html')) or n.endswith('Dockerfile'):
        pattern=r'^\s*#(?!\!)' if n.endswith(('.sh','.toml','Dockerfile')) else r'^\s*(?://|/\*|<!--)'
        assert not re.search(pattern,data.decode('utf-8'),re.M),n
for p in (TASK/'environment/assets').rglob('*'):
    if p.is_file():assert p.read_bytes()==(TASK/'tests/assets'/p.relative_to(TASK/'environment/assets')).read_bytes()

archive=OUT/'gambit-hollow-cribbage.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for n,data in sorted(files.items()):
        info=zipfile.ZipInfo(WRAPPER+n,(2026,9,14,0,0,0))
        info.create_system=3
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    z.extractall(OUT/'extracted')
upload=load('upload',ROOT/'references/task-templates/check-upload.py').audit(archive)
standard=load('standard',ROOT/'references/task-templates/check-standard.py').validate(OUT/'extracted'/TASK.name)
(OUT/'archive-checks.json').write_text(json.dumps(upload,indent=2)+'\n')
(OUT/'standard-checks.json').write_text(json.dumps(standard,indent=2)+'\n')
(OUT/'source-sha256.json').write_text(json.dumps({n:hashlib.sha256(data).hexdigest() for n,data in files.items()},indent=2)+'\n')
(OUT/'changes.json').write_text(json.dumps({'baseline':str(BASE),'zip_sha256':upload['sha256'],'changed_files':sorted(n for n in files if before.get(n)!=files[n]),'task_config_runtime_weights_timeouts_unchanged':True},indent=2)+'\n')
print('PASS',len(upload['checks']),'archive checks;',len(standard['checks']),'standard checks;',len(files),'files;',upload['criterion_count'],'criteria;',upload['sha256'])
