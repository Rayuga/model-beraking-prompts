from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
spec = importlib.util.spec_from_file_location('standard', ROOT / 'references/task-templates/check-standard.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
result = module.validate(TASK)
(OUT / 'standard-checks.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
files = {p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(OUT / 'before-oracle-reliability.zip') as archive:
    before = {n.split('/',1)[1]:archive.read(n) for n in archive.namelist()}
assert len(files)==32 and files.keys()==before.keys()
changed = sorted(n for n in files if files[n]!=before[n])
assert changed==['tests/functional/judge.toml','tests/functional/prompt.md'],changed
old = tomllib.loads(before['tests/functional/judge.toml'].decode('utf-8'))
new = tomllib.loads(files['tests/functional/judge.toml'].decode('utf-8'))
restored = copy.deepcopy(new)
changes = json.loads((OUT / 'verifier-changes.json').read_text(encoding='utf-8'))
actual = []
for previous,current,revert in zip(old['criterion'],new['criterion'],restored['criterion'],strict=True):
    assert previous['id']==current['id']
    if previous['description']!=current['description']:
        actual.append(current['id'])
        change = next(c for c in changes if c['id']==current['id'])
        assert change['before']==previous['description']
        assert change['after']==current['description']
        revert['description']=previous['description']
assert restored==old
assert len(actual)==3 and set(actual)=={c['id'] for c in changes}
for name,data in files.items():
    if name.endswith('.toml'):
        tomllib.loads(data.decode('utf-8'))
        assert not any(line.lstrip().startswith(b'#') for line in data.splitlines()),name
browser = json.loads((OUT / 'oracle-three-results.json').read_text())
assert len(browser)==3 and all(r['passed'] for r in browser)
archive_path = OUT / 'patchpad-editor-v2.zip'
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
report=dict(task='patchpad-editor-v2',version='1.0.0',file_count=len(files),
            zip_sha256=sha(archive_path.read_bytes()),changed_files=changed,
            changed_criteria=actual,all_other_parsed_judge_values_preserved=True,
            golden_app_unchanged=True,standard_checks=len(result['checks']),
            browser_reproductions_passed=3,full_oracle_rerun=False,
            files={n:sha(data) for n,data in files.items()})
(OUT / 'package-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
