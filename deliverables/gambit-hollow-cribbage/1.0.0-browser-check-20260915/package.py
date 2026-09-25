from pathlib import Path
import hashlib, importlib.util, json, zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/gambit-hollow-cribbage'
BASE=OUT.parent/'1.0.0-resilient-matches-20260914/gambit-hollow-cribbage.zip'
PREFIX=TASK.name+'/'
with zipfile.ZipFile(BASE) as z:
    before={n.removeprefix(PREFIX):z.read(n) for n in z.namelist()}
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert files.keys()==before.keys()
changes=sorted(n for n,data in files.items() if data!=before[n])
assert changes==sorted(['instruction.md','environment/Dockerfile','environment/assets/club/README.md','tests/assets/club/README.md']),changes
assert files['environment/assets/club/README.md']==files['tests/assets/club/README.md']
archive=OUT/'gambit-hollow-cribbage.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        item=zipfile.ZipInfo(PREFIX+name,(2026,9,15,0,0,0))
        item.create_system=3
        item.compress_type=zipfile.ZIP_DEFLATED
        item.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(item,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    z.extractall(OUT/'extracted')
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m
upload=module('upload',ROOT/'references/task-templates/check-upload.py').audit(archive)
standard=module('standard',ROOT/'references/task-templates/check-standard.py').validate(OUT/'extracted'/TASK.name)
for name,value in [('archive-checks.json',upload),('standard-checks.json',standard),('source-sha256.json',{n:hashlib.sha256(v).hexdigest() for n,v in files.items()}),('changes.json',{'baseline':str(BASE),'changed_files':changes,'golden_and_verifiers_byte_identical':True,'zip_sha256':upload['sha256']})]:
    (OUT/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
print(f"PASS {len(upload['checks'])} archive checks; {len(standard['checks'])} standard checks; {len(files)} files; {upload['criterion_count']} criteria; SHA256 {upload['sha256']}")
