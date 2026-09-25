from pathlib import Path
import hashlib, importlib.util, json, shutil, zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/gambit-hollow-cribbage'
WRAPPER=TASK.name+'/'
BASE=OUT.parent/'1.0.0-asset-layout-fix-20260914/gambit-hollow-cribbage.zip'
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
standard=module('standard',ROOT/'references/task-templates/check-standard.py')
upload=module('upload',ROOT/'references/task-templates/check-upload.py')
with zipfile.ZipFile(BASE) as z: old={n.removeprefix(WRAPPER):z.read(n) for n in z.namelist()}
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert files.keys()==old.keys()
changed=[n for n in files if files[n]!=old[n]]
assert set(changed)=={'tests/polish/prompt.md','tests/functional/prompt.md','tests/functional/judge.toml'},changed
def write_zip(path,data):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for name,b in sorted(data.items()):
            info=zipfile.ZipInfo(WRAPPER+name,(2026,9,14,0,0,0));info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16;z.writestr(info,b)
archive=OUT/'gambit-hollow-cribbage.zip';write_zip(archive,files)
result=upload.audit(archive);(OUT/'archive-checks.json').write_text(json.dumps(result,indent=2)+'\n')
extract=OUT/'extracted-final'/TASK.name
for n,b in files.items():
    p=(extract/n).resolve();assert p.is_relative_to(extract.resolve())
    p.parent.mkdir(parents=True,exist_ok=True)
    if p.exists(): assert p.read_bytes()==b,'Refuse to overwrite changed extracted files'
    else:p.write_bytes(b)
s=standard.validate(extract);(OUT/'standard-checks.json').write_text(json.dumps(s,indent=2)+'\n')
(OUT/'source-sha256.json').write_text(json.dumps({n:hashlib.sha256(b).hexdigest() for n,b in sorted(files.items())},indent=2)+'\n')
tests=[]
def rejects(name,path):
    try: upload.audit(path)
    except (AssertionError,ValueError) as e: tests.append({'name':name,'passed':True,'rejected_reason':str(e)})
    else: raise AssertionError('Invalid archive was accepted: '+name)
previous=OUT.parent/'1.0.0-criterion-review-20260914'
rejects('previous unwrapped ZIP',previous/'gambit-hollow-cribbage-v1.0.0-criterion-review.zip')
rejects('previous ZIP missing canonical assets',previous/'gambit-hollow-cribbage.zip')
cases={
 'assets under wrong source folder':{n.replace('environment/assets/club/','environment/club/',1):b.replace(b'COPY assets/ /assets/',b'COPY club/ /assets/club/') if n=='environment/Dockerfile' else b for n,b in files.items()},
 'missing referenced seed':{n:b for n,b in files.items() if n!='environment/assets/club/records/gambit_seed_data.json'},
 'missing visual prompt':{n:b for n,b in files.items() if n!='tests/visual/prompt.md'},
 'CRLF shell':{**files,'tests/test.sh':files['tests/test.sh'].replace(b'\n',b'\r\n')},
 'missing prompt marker':{**files,'tests/visual/prompt.md':files['tests/visual/prompt.md'].replace(b'Prompt version:',b'Old marker:')},
 'duplicate JSON key':{**files,'solution/package.json':b'{"name":"a","name":"b"}'},
 'case collision':{**files,'Instruction.md':files['instruction.md']},
 'bad COPY source':{**files,'environment/Dockerfile':files['environment/Dockerfile'].replace(b'COPY assets/',b'COPY missing/')},
 'negative criterion weight':{**files,'tests/functional/judge.toml':files['tests/functional/judge.toml'].replace(b'weight = 1.0',b'weight = -1.0',1)},
}
for i,(name,data) in enumerate(cases.items()):
    path=OUT/f'regression-{i}.zip';write_zip(path,data);rejects(name,path)
path=OUT/'regression-nonexecutable.zip'
with zipfile.ZipFile(archive) as source,zipfile.ZipFile(path,'w') as target:
    for info in source.infolist():
        if info.filename.endswith('/tests/test.sh'):info.external_attr=0o100644<<16
        target.writestr(info,source.read(info.filename))
rejects('runner lost executable permissions',path)
(OUT/'checker-regression.json').write_text(json.dumps({'results':tests},indent=2)+'\n')
for name in ('browser.cjs','unit.cjs','run-local.sh','negative-runner.sh'):
    if not (OUT/name).exists():shutil.copyfile(previous/name,OUT/name)
(OUT/'changes.json').write_text(json.dumps({'baseline':str(BASE),'changed_files':changed,'reason':'Repair Polish viewport text; align runtime database check with documented DB_PATH relocation; increment affected prompts to r4','zip_sha256':result['sha256']},indent=2)+'\n')
print('PASS',len(result['checks']),'archive checks,',len(s['checks']),'standard checks,',len(tests),'bad-archive regressions')
