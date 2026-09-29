from pathlib import Path, PurePosixPath
import hashlib
import json
import stat
import tomllib
import zipfile

task=Path('projects/ridgeline-print-storefront').resolve()
out=Path(__file__).resolve().parent
archive=out/(task.name+'.zip')
forbidden={'.git','.gitignore','.packageignore','node_modules','__pycache__','coverage.json','SHA256SUMS.txt','.env','reward.toml'}
files=sorted(p for p in task.rglob('*') if p.is_file())
manifest={}
for p in files:
    relative=p.relative_to(task)
    assert not set(relative.parts)&forbidden,relative
    assert p.suffix.lower() not in {'.db','.sqlite','.sqlite3','.xlsx','.zip','.pyc'},relative
    assert not p.is_symlink(),relative
    if p.suffix=='.sh': assert b'\r' not in p.read_bytes(),relative
    manifest[relative.as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files:
        info=zipfile.ZipInfo(task.name+'/'+p.relative_to(task).as_posix())
        info.create_system=3
        info.external_attr=(stat.S_IFREG|(0o755 if p.suffix=='.sh' else 0o644))<<16
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,p.read_bytes())
sha=hashlib.sha256(archive.read_bytes()).hexdigest()
extract=out/('archive-check-'+sha[:12])
extract.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(files)
    for member in z.infolist():
        path=PurePosixPath(member.filename)
        assert path.parts[0]==task.name and '..' not in path.parts and '\\' not in member.filename
        if path.suffix=='.sh': assert (member.external_attr>>16)&0o111
    z.extractall(extract)
    for relative,digest in manifest.items():
        assert hashlib.sha256((extract/task.name/relative).read_bytes()).hexdigest()==digest,relative
assert (extract/task.name/'tests/.dockerignore').is_file()
assert (extract/task.name/'environment/assets/seed_data.json').is_file()
configuration=tomllib.loads((extract/task.name/'task.toml').read_text())
assert configuration['task']['name']=='turing/'+task.name
dimensions={}
for p in (extract/task.name/'tests').glob('*/*/judge.toml'):
    parsed=tomllib.loads(p.read_text())
    dimensions[p.parent.name]={'criteria':len(parsed['criterion']),'weight':sum(c['weight'] for c in parsed['criterion'])}
assert sum(d['criteria'] for d in dimensions.values())==28
assert dimensions['functional']=={'criteria':16,'weight':35}
result={'archive':archive.name,'sha256':sha,'bytes':archive.stat().st_size,'files':len(files),'single_root':task.name,
        'crc_passed':True,'extraction_hash_match':True,'shell_modes_passed':True,'dimensions':dimensions,
        'source_sha256':manifest,'oracle_measured':False,'target_model_measured':False}
(out/'candidate_manifest.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='source_sha256'},indent=2))
