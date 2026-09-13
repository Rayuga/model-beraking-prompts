from pathlib import Path
import hashlib
import json
import re
import tomllib
import zipfile

out=Path(__file__).resolve().parent
root=out.parents[2]
task=root/'projects/patchpad-editor-v3'
old=root/'projects/patchpad-editor-v2'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert {p.relative_to(old).as_posix():sha(p.read_bytes()) for p in old.rglob('*') if p.is_file()}==json.loads((out/'v2-baseline.json').read_text())
cfg=tomllib.loads((task/'task.toml').read_text())
assert cfg['task']['name']=='turing/patchpad-editor-v3'
assert cfg['task']['version']=='1.0.0'
assert cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public'
oldf=tomllib.loads((old/'tests/functional/judge.toml').read_text())['criterion']
newf=tomllib.loads((task/'tests/functional/judge.toml').read_text())['criterion']
oldweights={c['id']:c['weight'] for c in oldf}
newweights={c['id']:c['weight'] for c in newf}
assert all(newweights[key]==value for key,value in oldweights.items())
assert len(newf)==29 and len(newweights)==29
for f in ('environment/Dockerfile','tests/Dockerfile','tests/test.sh'):
    assert not re.search(r'(OPENAI|OPENROUTER)[_ -]*API[_ -]*KEY',(task/f).read_text(),re.I)
for f in ('new-requirements-results.json','bounded-results.json'):
    assert all(row['passed'] for row in json.loads((out/f).read_text())['results'])
files=sorted(p for p in task.rglob('*') if p.is_file())
hashes={}
zip_path=out/'patchpad-editor-v3.zip'
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for p in files:
        rel=p.relative_to(task)
        assert not p.is_symlink()
        assert not any(x in rel.parts for x in ('node_modules','.git','__pycache__','reports'))
        assert p.suffix not in ('.db','.sqlite','.pyc','.zip','.log') and not p.name.startswith('.env')
        data=p.read_bytes()
        if p.suffix in ('.toml','.md','.sh','.json','.js','.html') or p.name=='Dockerfile':
            text=data.decode('utf-8')
            assert 'patchpad-editor-v2' not in text
            assert not re.search(r'(?:sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}',text)
        if p.suffix=='.toml':tomllib.loads(data.decode('utf-8'))
        name='patchpad-editor-v3/'+rel.as_posix()
        info=zipfile.ZipInfo(name,date_time=(2026,9,13,0,0,0))
        info.create_system=3
        info.external_attr=(0o100755 if p.suffix=='.sh' else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,data)
        hashes[name]=sha(data)
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    assert {i.filename:sha(z.read(i)) for i in z.infolist()}==hashes
result=dict(zip=str(zip_path),sha256=sha(zip_path.read_bytes()),files=len(files),source_hashes=hashes,v2_source_unchanged=True,old_criterion_weights_unchanged=True,functional_count=29,functional_weight=sum(newweights.values()),public_network_both=True)
(out/'package-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='source_hashes'},indent=2))
