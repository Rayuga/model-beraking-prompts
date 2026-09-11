"""Verify a rename-only v3 fork, preserve v2, and emit one task ZIP."""
from pathlib import Path
import hashlib, json, tomllib, zipfile
out=Path(__file__).resolve().parent
root=next(p for p in out.parents if (p/'projects').is_dir())
old=root/'projects/gridforge-spreadsheet-v2'
task=root/'projects/gridforge-spreadsheet-v3'
previous=out.parent/'gridforge-v2-2.0.12-validation/gridforge-spreadsheet-v2.zip'
checks=[]
def check(name,ok):
    checks.append({'name':name,'passed':bool(ok)})
    assert ok,name
check('v2 ZIP unchanged',hashlib.sha256(previous.read_bytes()).hexdigest()=='bbf5f52469afec0dd64d8b6819801d2755983df1e21f0931031c3564a6ec8d73')
files={p.relative_to(task).as_posix():p for p in task.rglob('*') if p.is_file()}
with zipfile.ZipFile(previous) as z:
    check('same exact 32 task files',{'gridforge-spreadsheet-v2/'+p for p in files}==set(z.namelist()) and len(files)==32)
    for relative,p in sorted(files.items()):
        before=z.read('gridforge-spreadsheet-v2/'+relative)
        check('v2 unchanged: '+relative,(old/relative).read_bytes()==before)
        expected=before.decode().replace('gridforge-spreadsheet-v2','gridforge-spreadsheet-v3').replace('gridforge-v2-submission','gridforge-v3-submission').replace('2.0.12','3.0.0').replace('Version 2 restructures','Version 3 preserves the latest fixes and restructures')
        check('v3 rename-only: '+relative,p.read_text(encoding='utf-8')==expected.replace('\r\n','\n'))
        if p.suffix=='.toml':tomllib.loads(p.read_text(encoding='utf-8'))
        if p.suffix=='.json':json.loads(p.read_text(encoding='utf-8'))
c=tomllib.loads((task/'task.toml').read_text())
check('v3 identity',c['task']['name']=='turing/gridforge-spreadsheet-v3' and c['task']['version']=='3.0.0')
check('no target metadata',not {'active_target_model','active_target_reasoning_effort'} & c['metadata'].keys())
check('public agent and separate public verifier',c['environment']['network_mode']==c['verifier']['environment']['network_mode']=='public' and c['verifier']['environment_mode']=='separate')
check('latest judge env retained',c['verifier']['env']=={'OPENAI_API_KEY':'${OPENAI_API_KEY}','REWARDKIT_JUDGE':'codex','REWARDKIT_MODEL':'gpt-5.6-luna','REWARDKIT_REASONING_EFFORT':'max'})
count=0
for dimension in ('render','constraints','functional','polish'):
    j=tomllib.loads((task/'tests'/dimension/'judge.toml').read_text())
    count+=len(j['criterion'])
    check(dimension+' judge',j['judge']['model']=='gpt-5.6-luna' and j['judge']['reasoning_effort']=='max')
check('44 criteria',count==44)
archive=out/'gridforge-spreadsheet-v3.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for relative,p in sorted(files.items()):
        info=zipfile.ZipInfo('gridforge-spreadsheet-v3/'+relative,date_time=(2026,9,11,0,0,0))
        info.create_system=3;info.external_attr=(0o100755 if relative.endswith('.sh') else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
with zipfile.ZipFile(archive) as z:
    check('ZIP integrity',z.testzip() is None)
    check('one v3 wrapper',set(z.namelist())=={'gridforge-spreadsheet-v3/'+p for p in files})
    check('all archive bytes match source',all(z.read('gridforge-spreadsheet-v3/'+p)==f.read_bytes() for p,f in files.items()))
result={'scope':'Unpaid rename/preservation/package checks; not platform QC or Oracle','checks':checks,
        'source_sha256':{p:hashlib.sha256(f.read_bytes()).hexdigest() for p,f in files.items()},
        'archive':{'file':archive.name,'files':32,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}}
(out/'structural-checks.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'archive':result['archive']},indent=2))
