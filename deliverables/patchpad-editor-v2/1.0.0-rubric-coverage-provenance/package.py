from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import re
import tomllib
import zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2'
spec=importlib.util.spec_from_file_location('standard',ROOT/'references/task-templates/check-standard.py')
standard=importlib.util.module_from_spec(spec)
spec.loader.exec_module(standard)
checks=standard.validate(TASK)
(OUT/'standard-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(OUT/'before-rubric-fixes.zip') as z:
    old={n.split('/',1)[1]:z.read(n) for n in z.namelist()}
assert len(files)==32 and files.keys()==old.keys()
changed=sorted(n for n in files if files[n]!=old[n])
expected=sorted(['tests/test.sh','tests/functional/judge.toml']+[f'tests/{d}/prompt.md' for d in ('render','constraints','functional','polish','visual')])
assert changed==expected,changed
criterion_changes=[]
count=0
for d in ('render','constraints','functional','polish','visual'):
    path=f'tests/{d}/judge.toml'
    a=tomllib.loads(old[path].decode());b=tomllib.loads(files[path].decode())
    restored=copy.deepcopy(b)
    for ca,cb,cr in zip(a['criterion'],b['criterion'],restored['criterion'],strict=True):
        count+=1
        if ca['description']!=cb['description']:
            criterion_changes.append({'dimension':d,'id':ca['id'],'before':ca['description'],'after':cb['description']})
            cr['description']=ca['description']
    assert a==restored, 'Other criterion or configuration changed: '+d
    prompt=files[f'tests/{d}/prompt.md'].decode()
    assert not re.search(r'Docketlight|marketplace|following the reference|reference\s+template',prompt,re.I)
    assert not any(line.lstrip().startswith('#') for line in files[path].decode().splitlines())
assert count==39
assert len(criterion_changes)==1 and criterion_changes[0]['id']=='keyboard_navigation_exact_coordinates'
old_runner=old['tests/test.sh'].decode();new_runner=files['tests/test.sh'].decode()
anchor='if ! python3 - "$LOG_DIR/reward.json"'
assert old_runner.split(anchor,1)[1]==new_runner.split(anchor,1)[1], 'Final reward processing changed'
assert json.loads((OUT/'runtime-check.json').read_text())['passed']
assert json.loads((OUT/'line-number-check.json').read_text())['passed']
archive=OUT/'patchpad-editor-v2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('patchpad-editor-v2/'+name,(2026,9,11,0,0,0))
        info.create_system=3
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(info,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {n.split('/',1)[1]:z.read(n) for n in z.namelist()}==files
sha=lambda value:hashlib.sha256(value).hexdigest()
report={'version':'1.0.0','file_count':len(files),'criteria':count,'standard_checks':len(checks['checks']),'changed_files':changed,'all_weights_preserved':True,'golden_code_unchanged':True,'final_reward_processing_unchanged':True,'zip_integrity':'pass','zip_sha256':sha(archive.read_bytes()),'full_oracle_rerun':False,'files':{n:sha(data) for n,data in files.items()}}
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'verifier-changes.json').write_text(json.dumps(criterion_changes,indent=2)+'\n')
(OUT/'VERIFIER_BEFORE_AFTER.md').write_text('# Navigation verifier change\n\nOnly `keyboard_navigation_exact_coordinates` changed; its weight is still 1.0.\n\n## Before\n\n'+criterion_changes[0]['before'].strip()+'\n\n## After\n\n'+criterion_changes[0]['after'].strip()+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
