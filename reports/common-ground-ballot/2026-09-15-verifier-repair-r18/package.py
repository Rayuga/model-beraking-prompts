"""Freeze only validated r18 bytes; preserve historical ZIPs and failed evidence."""
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tomllib
import zipfile

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
TASK=ROOT/'projects/common-ground-ballot'
DELIVERY=ROOT/'deliverables/common-ground-ballot/2026-09-16-verifier-repair-r18'
PREVIOUS=ROOT/'deliverables/common-ground-ballot/2026-09-15-recovery-r17/common-ground-ballot.zip'
FROZEN=OUT/'frozen/common-ground-ballot'
DIMS=('render','constraints','functional','polish','visual')
sha=lambda data:hashlib.sha256(data).hexdigest()
read=lambda path:json.loads(path.read_text(encoding='utf-8'))
def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def tree(path):
    result={}
    for file in sorted(path.rglob('*')):
        assert not file.is_symlink(),file
        if file.is_file():result[file.relative_to(path).as_posix()]=file.read_bytes()
    return result
def checker(name):
    path=ROOT/'references/task-templates'/f'{name}.py'
    spec=importlib.util.spec_from_file_location(name.replace('-','_'),path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

files=tree(TASK)
with zipfile.ZipFile(PREVIOUS) as z:
    before={name.split('/',1)[1]:z.read(name) for name in z.namelist() if not name.endswith('/')}
for name,data in before.items():
    if name.startswith(('solution/','environment/')) or name in ('instruction.md','task.toml','tests/score.py','tests/reward.toml'):
        assert files[name]==data,('Protected product/scoring contract changed',name)
counts={};weights={}
for dim in DIMS:
    current=tomllib.loads(files[f'tests/{dim}/judge.toml'].decode())
    previous=tomllib.loads(before[f'tests/{dim}/judge.toml'].decode())
    assert current['judge']==previous['judge'] and current['scoring']==previous['scoring']
    strip=lambda config:[{key:value for key,value in criterion.items() if key!='description'} for criterion in config['criterion']]
    assert strip(current)==strip(previous),('Criterion identity/weight/type changed',dim)
    counts[dim]=len(current['criterion']);weights[dim]=current['judge']['weight']
assert sum(counts.values())==68 and counts['functional']==49
expected_new={'tests/browser-evidence.js','tests/codex-trace.py'}
assert set(files)-set(before)==expected_new and not(set(before)-set(files))
text=files['tests/functional/prompt.md'].decode()
assert all(f'## Phase {phase}:' in text for phase in 'ABCD')
assert 'e.send(' not in text and '"filename":"/tests/browser-evidence.js"' in text
assert 'one** final trusted' in text
assert b'after restart 2' not in files['tests/functional/judge.toml']
assert b'after each of the two' not in files['tests/functional/judge.toml'].lower()
assert len(text.split()) < .6*len(before['tests/functional/prompt.md'].decode().split())

evidence={}
for name,relative,minimum in [
    ('trace','trace-results.json',8),('runtime','validation-runtime/runtime-results.json',5),
    ('harness','validation-harness/harness-results.json',19),('recovery','validation-recovery/recovery-results.json',23),
    ('boundaries','validation-boundaries/strict-boundaries-results.json',58),('helper','helper-integration/helper-results.json',19),
]:
    report=read(OUT/relative)
    rows=report.get('checks',report.get('results',[]))
    assert len(rows)>=minimum and all(row.get('passed') is True for row in rows),(name,report)
    assert report.get('failed',0)==0
    evidence[name]={'groups':len(rows),'file':relative,'sha256':sha((OUT/relative).read_bytes()),'passed':True}

# Compare every shipped test file to the actual cached image used for validation.
command=['docker','run','--rm','--network','none','ballot-verifier:20260915-r18-local','python3','-c',
         "import hashlib,json;from pathlib import Path;p=Path('/tests');print(json.dumps({f.relative_to(p).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file() and '__pycache__' not in f.parts}))"]
image_result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',timeout=30,check=True)
image_hashes=json.loads(image_result.stdout)
expected_hashes={name.removeprefix('tests/'):sha(data) for name,data in files.items() if name.startswith('tests/')}
assert image_hashes==expected_hashes,'The tested image must contain exactly the shipped verifier bytes'
write(OUT/'image-test-hashes.json',image_hashes)
assert not FROZEN.exists(),'Do not replace the frozen r18 task'
for name,data in files.items():
    target=FROZEN/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
assert tree(FROZEN)==files
standard=checker('check-standard').validate(FROZEN)
write(OUT/'check-standard.json',standard)
candidate=OUT/'candidate.zip'
assert not candidate.exists(),'Do not overwrite candidate bytes'
with zipfile.ZipFile(candidate,'x',zipfile.ZIP_DEFLATED) as z:
    for name,data in files.items():
        entry=zipfile.ZipInfo('common-ground-ballot/'+name,(2026,9,16,0,0,0))
        entry.create_system=3;entry.external_attr=(0o100755 if name.endswith('.sh') or name=='tests/codex-trace.py' else 0o100644)<<16
        entry.compress_type=zipfile.ZIP_DEFLATED;z.writestr(entry,data)
upload=checker('check-upload').audit(candidate)
write(OUT/'check-upload.json',upload)
assert standard['passed'] and upload['passed']
with zipfile.ZipFile(candidate) as z:
    assert z.testzip() is None
    assert {name.split('/',1)[1]:z.read(name) for name in z.namelist()}==files
DELIVERY.mkdir(parents=True,exist_ok=True)
archive=DELIVERY/'common-ground-ballot.zip'
assert not archive.exists(),'Historical deliverables are immutable'
shutil.copyfile(candidate,archive)
manifest={'task':'common-ground-ballot','revision':'r18','task_version':'1.0.0',
    'archive':str(archive.relative_to(ROOT)),'sha256':sha(archive.read_bytes()),'file_count':len(files),
    'criterion_counts':counts,'total_criteria':68,'dimension_weights':weights,
    'product_and_golden_unchanged':True,'criterion_ids_types_weights_unchanged':True,'scoring_unchanged':True,
    'functional_prompt_words_before':len(before['tests/functional/prompt.md'].decode().split()),
    'functional_prompt_words_after':len(text.split()),
    'changed_files':[name for name in files if files[name]!=before.get(name)],
    'standard_checks':len(standard['checks']),'upload_checks':len(upload['checks']),
    'regression_groups':sum(value['groups'] for value in evidence.values()),'validation':evidence,
    'tested_verifier_image':'ballot-verifier:20260915-r18-local','image_matches_shipped_tests':True,
    'build':'Cached pinned r17 dependencies plus the actual r18 verifier files and wrapper installation; not a clean dependency-download build.',
    'fresh_scored_oracle':False,'fresh_scored_model':False,'platform_qc':False,
    'scored_run_limit':'No configured platform execution tool or OpenAI credential for the mandated judge was available locally. No substitute model was scored.',
    'status':'Repair candidate validated locally; platform QC and a fresh scored Oracle remain required.'}
write(OUT/'package-audit.json',manifest)
write(DELIVERY/'package-audit.json',manifest)
write(OUT/'source-hashes.json',{name:sha(data) for name,data in files.items()})
(DELIVERY/'SHA256SUMS.txt').write_text(manifest['sha256']+'  common-ground-ballot.zip\n',encoding='utf-8')
for name,data in evidence.items():shutil.copyfile(OUT/data['file'],DELIVERY/(name+'-results.json'))
for name in ('check-standard.json','check-upload.json'):shutil.copyfile(OUT/name,DELIVERY/name)
diff=[]
for name in manifest['changed_files']:
    diff.extend(difflib.unified_diff(before.get(name,b'').decode().splitlines(True),files[name].decode().splitlines(True),fromfile='r17/'+name,tofile='r18/'+name))
(OUT/'changes.diff').write_text(''.join(diff),encoding='utf-8')
print(json.dumps({key:value for key,value in manifest.items() if key!='validation'},indent=2))
