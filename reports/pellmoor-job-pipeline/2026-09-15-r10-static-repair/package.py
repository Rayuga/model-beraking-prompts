from pathlib import Path
import ast
import difflib
import hashlib
import json
import re
import subprocess
import sys
import tomllib
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/pellmoor-job-pipeline'
OUT = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r10-static-repair-20260915'
BASE = OUT.parent / '1.0.0-r9-qc-repair-20260915'
sha = lambda data: hashlib.sha256(data).hexdigest()
baseline = json.loads((BASE / 'package-verification.json').read_text())
assert sha((BASE / 'pellmoor-job-pipeline.zip').read_bytes()) == baseline['zip_sha256']
canonical = TASK / 'environment/assets/recruitment/records/pellmoor_seed_data.json'
(TASK / 'tests/pellmoor_seed_data.json').write_bytes(canonical.read_bytes())
files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
removed = set(baseline['source_sha256']) - files.keys()
assert removed == {'tests/rewardkit-compat.py'}
changed = {name for name, data in files.items() if sha(data) != baseline['source_sha256'].get(name)}
assert changed == {'tests/render/judge.toml','tests/constraints/judge.toml','tests/Dockerfile','tests/test.sh','tests/reward.toml','tests/SCORING.md'}
for name, digest in baseline['source_sha256'].items():
    if name.startswith('solution/') or name.endswith('/prompt.md') or name == 'task.toml':
        assert sha(files[name]) == digest, name
for dimension in ('render','constraints','functional','polish','visual'):
    current = tomllib.loads(files[f'tests/{dimension}/judge.toml'].decode())
    old = tomllib.loads((BASE / f'task/pellmoor-job-pipeline/tests/{dimension}/judge.toml').read_text())
    assert current['criterion'] == old['criterion']
    assert current['scoring'] == old['scoring']
    expected = dict(old['judge'])
    if dimension in ('render','constraints'):
        expected['weight'] = 1.0
    assert current['judge'] == expected
assert tomllib.loads(files['tests/reward.toml'].decode()) == {'reward': []}
last_block = lambda text: re.findall(r"<<'PY'\n(.*?)\nPY", text, re.S)[-1]
assert last_block(files['tests/test.sh'].decode()) == last_block((BASE / 'task/pellmoor-job-pipeline/tests/test.sh').read_text())
for name, data in files.items():
    assert b'\r\n' not in data, name
    if name.endswith('.toml'):
        tomllib.loads(data.decode())
    if name.endswith('.py'):
        ast.parse(data.decode())
    if name.endswith(('.js','.ts','.html')):
        assert not re.search(rb'^\s*(?://|/\*|<!--)', data, re.M), name
    if name.endswith(('.py','.toml','.sh')) or name.endswith('Dockerfile'):
        assert not re.search(rb'^\s*#(?!\!)', data, re.M), name
    assert b'rewardkit-compat.py' not in data, name
OUT.mkdir(parents=True, exist_ok=True)
archive = OUT / 'pellmoor-job-pipeline.zip'
assert not archive.exists(), 'Do not overwrite frozen archives'
diff = []
with zipfile.ZipFile(BASE / 'pellmoor-job-pipeline.zip') as before:
    for name in sorted(changed | removed):
        old = before.read('pellmoor-job-pipeline/' + name) if name in baseline['source_sha256'] else b''
        new = files.get(name, b'')
        diff.extend(difflib.unified_diff(old.decode().splitlines(True), new.decode().splitlines(True), fromfile='r9/'+name, tofile='r10/'+name))
(OUT / 'source-changes.diff').write_text(''.join(diff), encoding='utf-8', newline='\n')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo('pellmoor-job-pipeline/' + name, (2026,9,15,0,0,0))
        info.create_system = 3
        info.external_attr = (0o100755 if name.endswith('.sh') else 0o100644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        package.writestr(info, data)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert {name.split('/',1)[1]:package.read(name) for name in package.namelist()} == files
    package.extractall(OUT / 'task')
checks = {}
for name, target in [('standard', OUT/'task/pellmoor-job-pipeline'), ('upload', archive)]:
    result = subprocess.run([sys.executable,str(ROOT/f'references/task-templates/check-{name}.py'),str(target),'--output',str(OUT/f'{name}-qc.json')], capture_output=True, text=True, encoding='utf-8')
    (OUT/f'{name}-qc.log').write_text(result.stdout+result.stderr,encoding='utf-8')
    checks[name] = {'passed':result.returncode==0,'exit_code':result.returncode}
manifest = {'status':'Static schema repair; hosted QC and Oracle pending','zip_sha256':sha(archive.read_bytes()),'previous_zip_sha256':baseline['zip_sha256'],'files':len(files),'changed_files':sorted(changed),'removed_files':sorted(removed),'source_sha256':{name:sha(data) for name,data in sorted(files.items())},'all_60_criteria_and_prompts_unchanged':True,'golden_solution_unchanged':True,'final_reward_postprocessor_unchanged':True,'task_configuration_and_timeouts_unchanged':True,'native_rewardkit_scoring':True,'verifier_seed_generated_from_canonical':True,'local_checks':checks,'fresh_platform_qc':False,'fresh_hosted_oracle':False}
(OUT/'package-verification.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert all(c['passed'] for c in checks.values()), checks
print(json.dumps({k:v for k,v in manifest.items() if k!='source_sha256'},indent=2))
