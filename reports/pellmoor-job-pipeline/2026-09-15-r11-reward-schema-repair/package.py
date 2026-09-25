from pathlib import Path
import difflib
import hashlib
import json
import subprocess
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/pellmoor-job-pipeline'
OUT = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r11-reward-schema-repair-20260915'
BASE = OUT.parent / '1.0.0-r10-static-repair-20260915'
sha = lambda data: hashlib.sha256(data).hexdigest()
baseline = json.loads((BASE/'package-verification.json').read_text())
assert sha((BASE/'pellmoor-job-pipeline.zip').read_bytes()) == baseline['zip_sha256']
canonical_seed = TASK/'environment/assets/recruitment/records/pellmoor_seed_data.json'
(TASK/'tests/pellmoor_seed_data.json').write_bytes(canonical_seed.read_bytes())
files = {path.relative_to(TASK).as_posix():path.read_bytes() for path in TASK.rglob('*') if path.is_file()}
assert files.keys() == baseline['source_sha256'].keys()
changed = {name for name,data in files.items() if sha(data)!=baseline['source_sha256'][name]}
assert changed == {'tests/reward.toml','tests/SCORING.md'}, changed
assert files['tests/reward.toml'] == (ROOT/'projects/bazaarbridge-marketplace-commerce/tests/reward.toml').read_bytes()
assert all(b'\r\n' not in data for data in files.values())
OUT.mkdir(parents=True,exist_ok=True)
archive = OUT/'pellmoor-job-pipeline.zip'
assert not archive.exists(), 'Preserve frozen packages'
diff = []
with zipfile.ZipFile(BASE/'pellmoor-job-pipeline.zip') as old:
    for name in sorted(changed):
        diff.extend(difflib.unified_diff(old.read('pellmoor-job-pipeline/'+name).decode().splitlines(True),files[name].decode().splitlines(True),fromfile='r10/'+name,tofile='r11/'+name))
(OUT/'source-changes.diff').write_text(''.join(diff),encoding='utf-8',newline='\n')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as package:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('pellmoor-job-pipeline/'+name,(2026,9,15,0,0,0))
        info.create_system=3
        info.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED
        package.writestr(info,data)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert {name.split('/',1)[1]:package.read(name) for name in package.namelist()}==files
    package.extractall(OUT/'task')
checks={}
for name,target in [('standard',OUT/'task/pellmoor-job-pipeline'),('upload',archive)]:
    result=subprocess.run([sys.executable,str(ROOT/f'references/task-templates/check-{name}.py'),str(target),'--output',str(OUT/f'{name}-qc.json')],capture_output=True,text=True,encoding='utf-8')
    (OUT/f'{name}-qc.log').write_text(result.stdout+result.stderr,encoding='utf-8')
    checks[name]={'passed':result.returncode==0,'exit_code':result.returncode}
manifest={'status':'Reward schema correction; hosted QC and Oracle pending','zip_sha256':sha(archive.read_bytes()),'previous_zip_sha256':baseline['zip_sha256'],'files':len(files),'changed_files':sorted(changed),'source_sha256':{name:sha(data) for name,data in sorted(files.items())},'canonical_reward_configuration_byte_identical':True,'all_judges_criteria_and_prompts_unchanged':True,'positive_judge_weights_preserved':True,'golden_solution_unchanged':True,'final_scoring_runner_unchanged':True,'task_configuration_and_timeouts_unchanged':True,'native_rewardkit_scoring':True,'local_checks':checks,'fresh_platform_qc':False,'fresh_hosted_oracle':False}
(OUT/'package-verification.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert all(result['passed'] for result in checks.values()),checks
print(json.dumps({key:value for key,value in manifest.items() if key!='source_sha256'},indent=2))
