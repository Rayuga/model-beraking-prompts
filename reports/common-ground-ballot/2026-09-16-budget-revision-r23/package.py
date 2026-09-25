import hashlib
import json
from pathlib import Path
import stat
import tomllib
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'
DEST=ROOT/'deliverables/common-ground-ballot/2026-09-16-budget-revision-r23'
PREVIOUS=ROOT/'deliverables/common-ground-ballot/2026-09-16-product-gate-r22/common-ground-ballot.zip'
with zipfile.ZipFile(PREVIOUS) as archive:
    old={info.filename.split('/',1)[1]:archive.read(info) for info in archive.infolist()}
current={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert current.keys()==old.keys() and len(current)==29
changes=sorted(name for name in current if current[name]!=old[name])
expected=['README.md','tests/constraints/judge.toml','tests/functional/judge.toml','tests/functional/prompt.md','tests/render/judge.toml']
assert changes==expected,changes
old_judge=tomllib.loads(old['tests/functional/judge.toml'].decode())
new_judge=tomllib.loads(current['tests/functional/judge.toml'].decode())
old_criteria={c['id']:c for c in old_judge['criterion']}
new_criteria={c['id']:c for c in new_judge['criterion']}
assert set(new_criteria)-set(old_criteria)=={'accepted_votes_preserve_ballot_revision'}
assert all(new_criteria[key]==value for key,value in old_criteria.items())
for dimension in ('render','constraints'):
    before=tomllib.loads(old[f'tests/{dimension}/judge.toml'].decode())
    after=tomllib.loads(current[f'tests/{dimension}/judge.toml'].decode())
    before['judge']['timeout']=after['judge']['timeout']
    assert before==after
assert all(row['passed'] for row in json.loads((HERE/'revision-results.json').read_text()))
assert all(row['passed'] for row in json.loads((HERE/'runtime-results.json').read_text()))
assert json.loads((HERE/'budget-score/budget-and-score-results.json').read_text())['failed']==0
DEST.mkdir(parents=True,exist_ok=True)
target=DEST/'common-ground-ballot.zip'
assert not target.exists(),'Do not overwrite a delivered archive'
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name,data in sorted(current.items()):
        info=zipfile.ZipInfo('common-ground-ballot/'+name,(2026,9,16,0,0,0));info.create_system=3
        info.external_attr=(stat.S_IFREG|(0o755 if name.endswith('.sh') else 0o644))<<16
        info.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(info,data)
manifest={'archive':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
          'changed_from_r22':changes,'unchanged_files':len(current)-len(changes),'file_count':len(current),
          'existing_functional_criteria_unchanged':True,'golden_unchanged':True,'brief_unchanged':True,
          'task_toml_unchanged':True,'runner_and_score_formula_unchanged':True,'read_only_floor_gate_unchanged':True}
(HERE/'package-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(manifest,indent=2))
