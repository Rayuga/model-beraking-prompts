from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r10-static-repair-20260915'
BASE = OUT.parent / '1.0.0-r9-qc-repair-20260915'
read = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = read(OUT/'package-verification.json')
assert sha(OUT/'pellmoor-job-pipeline.zip') == manifest['zip_sha256']
assert sha(BASE/'pellmoor-job-pipeline.zip') == manifest['previous_zip_sha256']
for name,digest in manifest['source_sha256'].items():
    assert sha(OUT/'task/pellmoor-job-pipeline'/name) == digest, name
    assert sha(ROOT/'projects/pellmoor-job-pipeline'/name) == digest, name
assert not (ROOT/'projects/pellmoor-job-pipeline/tests/rewardkit-compat.py').exists()
runtime = read(HERE/'runtime/results.json')
assert len(runtime['results']) == 119 and all(case['passed'] for case in runtime['results'])
assert not runtime['framework_source_patches_applied'] and runtime['reward_specs'] == []
for name,digest in runtime['source_sha256'].items():
    assert digest == manifest['source_sha256']['tests/'+name], name
golden = read(HERE/'golden-validation/batch-regressions.json')['results']
assert len(golden) == 14 and all(group['status']=='passed' for group in golden)
execution = read(HERE/'golden-validation/execution-status.json')
assert execution['exit_code'] == 0
provenance = read(HERE/'golden-validation/runner-logs/prompt-provenance.json')
assert provenance['runner_sha256'] == manifest['source_sha256']['tests/test.sh']
assert provenance['reward_config_sha256'] == manifest['source_sha256']['tests/reward.toml']
for dimension,values in provenance['judges'].items():
    assert values['judge_sha256'] == manifest['source_sha256'][f'tests/{dimension}/judge.toml']
    assert values['prompt_sha256'] == manifest['source_sha256'][f'tests/{dimension}/prompt.md']
for name,digest in provenance['support_files'].items():
    assert digest == manifest['source_sha256']['tests/'+name]
guards = read(HERE/'static-guard-results.json')
assert guards['final_archive_passed'] and len(guards['results']) == 5
assert all(case['passed'] for case in guards['results'])
standard,upload = read(OUT/'standard-qc.json'),read(OUT/'upload-qc.json')
assert standard['passed'] and upload['passed'] and upload['sha256']==manifest['zip_sha256']
run_hashes = read(OUT.parent/'1.0.0-r8-reliability-20260914/run-file-hashes.json')
assert all(sha(ROOT/'run-outputs/pellmoor-job-pipeline'/name)==digest for name,digest in run_hashes.items())
validation = {'zip_sha256':manifest['zip_sha256'],'local_checks_passed':True,'standard_checks':len(standard['checks']),'archive_checks':len(upload['checks']),'invalid_judge_weight_cases':len(guards['results']),'native_scoring_cases':len(runtime['results']),'golden_workflow_groups':len(golden),'golden_elapsed_seconds':execution['elapsed_seconds'],'all_tested_source_hashes_match_frozen_archive':True,'native_scoring_no_framework_patch':True,'r9_archive_unchanged':True,'preserved_historical_run_files':len(run_hashes),'fresh_platform_qc':False,'fresh_hosted_oracle':False,'fresh_exact_image_build':False,'scope':'Local schema, native scoring with synthetic judge inputs, and golden browser/lifecycle regressions; not hosted QC or model scores','checker_sha256':{name:sha(ROOT/f'references/task-templates/check-{name}.py') for name in ('standard','upload')}}
(OUT/'VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n')
manifest['validation'] = validation
(OUT/'package-verification.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(validation,indent=2))
