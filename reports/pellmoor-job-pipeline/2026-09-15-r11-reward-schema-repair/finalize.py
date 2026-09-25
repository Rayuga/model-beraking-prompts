from pathlib import Path
import hashlib
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=ROOT/'deliverables/pellmoor-job-pipeline/1.0.0-r11-reward-schema-repair-20260915'
BASE=OUT.parent/'1.0.0-r10-static-repair-20260915'
read=lambda path:json.loads(path.read_text(encoding='utf-8-sig'))
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
manifest=read(OUT/'package-verification.json')
assert sha(OUT/'pellmoor-job-pipeline.zip')==manifest['zip_sha256']
assert sha(BASE/'pellmoor-job-pipeline.zip')==manifest['previous_zip_sha256']
for name,digest in manifest['source_sha256'].items():
    assert sha(OUT/'task/pellmoor-job-pipeline'/name)==digest,name
    assert sha(ROOT/'projects/pellmoor-job-pipeline'/name)==digest,name
runtime=read(HERE/'runtime/results.json')
assert len(runtime['results'])==120 and all(result['passed'] for result in runtime['results'])
assert runtime['loaded_reward_spec_count']==1 and runtime['reward_configuration_matches_canonical_bytes']
assert not runtime['framework_source_patches_applied']
for name,digest in runtime['source_sha256'].items():
    assert digest==manifest['source_sha256']['tests/'+name],name
regressions=read(HERE/'schema-regression-results.json')
assert regressions['final_archive_passed'] and len(regressions['results'])==6
assert all(result['passed'] for result in regressions['results'])
standard,upload=read(OUT/'standard-qc.json'),read(OUT/'upload-qc.json')
assert standard['passed'] and upload['passed'] and upload['sha256']==manifest['zip_sha256']
run_hashes=read(OUT.parent/'1.0.0-r8-reliability-20260914/run-file-hashes.json')
assert all(sha(ROOT/'run-outputs/pellmoor-job-pipeline'/name)==digest for name,digest in run_hashes.items())
validation={'zip_sha256':manifest['zip_sha256'],'local_checks_passed':True,'standard_checks':len(standard['checks']),'archive_checks':len(upload['checks']),'schema_negative_cases':6,'native_runtime_score_cases':120,'native_framework_source_unpatched':True,'final_scoring_runner_unchanged':True,'all_tested_source_hashes_match_frozen_archive':True,'previous_r10_archive_unchanged':True,'preserved_historical_run_files':len(run_hashes),'fresh_platform_qc':False,'fresh_hosted_oracle':False,'fresh_exact_image_build':False,'golden_workflows_rerun_this_revision':False,'previous_unchanged_golden_workflow_groups_passed':14,'scope':'Local schema guards and native runtime with explicit synthetic judge verdicts; not hosted QC or Oracle scores','checker_sha256':{name:sha(ROOT/f'references/task-templates/check-{name}.py') for name in ('standard','upload')}}
(OUT/'VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n')
manifest['validation']=validation
(OUT/'package-verification.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(validation,indent=2))
