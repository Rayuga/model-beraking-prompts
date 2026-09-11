"""Validate and package only the current task; authoring evidence stays outside."""
from pathlib import Path
import hashlib, importlib.util, json, zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2'
validator=ROOT/'references/task-templates/check-standard.py'
spec=importlib.util.spec_from_file_location('standard',validator)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
result=module.validate(TASK)
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files)==32,len(files)
assert not any(any(part in {'node_modules','__pycache__','.git'} for part in Path(n).parts) for n in files)
assert not any(n.endswith(('.db','.sqlite','.log','.png','.zip','.pyc')) for n in files)
with zipfile.ZipFile(OUT/'before-natural-brief.zip') as z:
    before={n.split('/',1)[1]:z.read(n) for n in z.namelist()}
changed=[n for n in files if before.get(n)!=files[n]]
assert files['environment/assets/incident_seed.json']==files['tests/incident_seed.json']
cfg=json.loads(files['solution/app/package.json'])
lock=json.loads(files['solution/app/package-lock.json'])
assert cfg['version']==lock['version']==lock['packages']['']['version']=='1.0.0'
assert cfg['dependencies']==lock['packages']['']['dependencies']=={'express':'5.1.0'}
assert lock['packages']['node_modules/express']['version']=='5.1.0'
archive=OUT/'patchpad-editor-v2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        i=zipfile.ZipInfo('patchpad-editor-v2/'+name,(2026,9,11,0,0,0))
        i.create_system=3;i.compress_type=zipfile.ZIP_DEFLATED
        i.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(i,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()}==files
    assert all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in z.namelist())
sha=lambda data:hashlib.sha256(data).hexdigest()
report=dict(task='patchpad-editor-v2',version='1.0.0',file_count=len(files),zip_sha256=sha(archive.read_bytes()),
    changed_since_desktop_visual=changed,files={n:sha(d) for n,d in files.items()},standard_checks=len(result['checks']))
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ('task','version','file_count','zip_sha256','standard_checks')},indent=2))
