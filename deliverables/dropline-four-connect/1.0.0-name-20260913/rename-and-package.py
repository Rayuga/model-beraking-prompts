from pathlib import Path
import hashlib
import json
import tomllib
import zipfile

out=Path(__file__).resolve().parent
root=out.parents[2]
task=root/'projects/dropline-four-connect'
previous=root/'deliverables/dropline-four-lite-v2/1.0.0-standard-20260912/dropline-four-lite-v2.zip'
oldslug='dropline-four-lite-v2'
slug='dropline-four-connect'
sha=lambda data:hashlib.sha256(data).hexdigest()
assert sha(previous.read_bytes())=='70bec9871a565da1ef2880042066aa8923dd9f9154a0fffb6c56cc96a8de26cf'
with zipfile.ZipFile(previous) as z:
    baseline={name.removeprefix(oldslug+'/'):z.read(name) for name in z.namelist()}
files={p.relative_to(task).as_posix():p for p in task.rglob('*') if p.is_file()}
assert set(files)==set(baseline)
changed=[]
for name,p in files.items():
    expected=baseline[name].replace(oldslug.encode(),slug.encode())
    actual=p.read_bytes()
    assert actual in (baseline[name],expected), 'Unexpected non-naming change: '+name
    if expected!=baseline[name]:
        p.write_bytes(expected)
        changed.append(name)
    assert p.read_bytes()==expected
cfg=tomllib.loads((task/'task.toml').read_text())
assert cfg['task']['name']=='turing/'+slug and cfg['task']['version']=='1.0.0'
assert cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public'
zip_path=out/(slug+'.zip')
hashes={}
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for name,p in sorted(files.items()):
        data=p.read_bytes()
        assert oldslug.encode() not in data
        info=zipfile.ZipInfo(slug+'/'+name,date_time=(2026,9,13,0,0,0))
        info.create_system=3
        info.external_attr=(0o100755 if p.suffix=='.sh' else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,data)
        hashes[info.filename]=sha(data)
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    assert {name.split('/')[0] for name in z.namelist()}=={slug}
    assert {name:sha(z.read(name)) for name in z.namelist()}==hashes
result=dict(zip=str(zip_path),sha256=sha(zip_path.read_bytes()),files=len(files),naming_only=True,changed_files=changed,source_hashes=hashes,previous_zip_unchanged=True)
(out/'package-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='source_hashes'},indent=2))
