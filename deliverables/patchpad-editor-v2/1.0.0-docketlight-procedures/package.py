from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import tomllib
import zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2'
spec=importlib.util.spec_from_file_location('standard',ROOT/'references/task-templates/check-standard.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
standard=module.validate(TASK)
(OUT/'standard-checks.json').write_text(json.dumps(standard,indent=2)+'\n',encoding='utf-8')
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(OUT/'before-docketlight-procedures.zip') as archive:
    before={n.split('/',1)[1]:archive.read(n) for n in archive.namelist()}
assert len(files)==32 and files.keys()==before.keys()
changed=sorted(n for n in files if files[n]!=before[n])
assert changed==['solution/app/public/index.html','solution/app/public/js/app.js','tests/functional/judge.toml','tests/functional/prompt.md'],changed
old=tomllib.loads(before['tests/functional/judge.toml'].decode('utf-8'))
new=tomllib.loads(files['tests/functional/judge.toml'].decode('utf-8'))
restore=copy.deepcopy(new)
changes=json.loads((OUT/'verifier-changes.json').read_text())
actual=[]
for a,b,c in zip(old['criterion'],new['criterion'],restore['criterion'],strict=True):
    assert a['id']==b['id']
    if a['description']!=b['description']:
        item=next(item for item in changes if item['id']==b['id'])
        assert item['before']==a['description'] and item['after']==b['description']
        actual.append(b['id'])
        c['description']=a['description']
assert restore==old and len(actual)==3
for name,data in files.items():
    if name.endswith('.toml'):
        tomllib.loads(data.decode('utf-8'))
        assert not any(line.lstrip().startswith(b'#') for line in data.splitlines()),name
    if name.endswith(('.js','.html')):
        assert not any(line.lstrip().startswith((b'//',b'/*',b'<!--')) for line in data.splitlines()),name
groups={}
for name in ('oracle-three-results.json','reproduction.json','additional-regression.json','desktop-review.json'):
    data=json.loads((OUT/name).read_text())
    records=data if isinstance(data,list) else data['results']
    assert all(record['passed'] for record in records),name
    if isinstance(data,dict):assert not data.get('errors'),name
    groups[name]=len(records)
focused=json.loads((OUT/'current-failures-1.0.0.json').read_text())
assert len(focused['passed'])==6
groups['current-failures-1.0.0.json']=len(focused['passed'])
assert all(r['exit_code']==0 for r in json.loads((OUT/'browser-results.json').read_text()))
archive_path=OUT/'patchpad-editor-v2.zip'
with zipfile.ZipFile(archive_path,'w',zipfile.ZIP_DEFLATED) as archive:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('patchpad-editor-v2/'+name,(2026,9,11,0,0,0))
        info.create_system=3
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        archive.writestr(info,data)
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    assert {n.split('/',1)[1]:archive.read(n) for n in archive.namelist()}==files
sha=lambda data:hashlib.sha256(data).hexdigest()
report=dict(task='patchpad-editor-v2',version='1.0.0',file_count=len(files),zip_sha256=sha(archive_path.read_bytes()),
            changed_files=changed,changed_criteria=actual,all_weights_preserved=True,
            standard_checks=len(standard['checks']),browser_groups=groups,browser_groups_passed=sum(groups.values()),
            full_oracle_rerun=False,files={n:sha(data) for n,data in files.items()})
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
