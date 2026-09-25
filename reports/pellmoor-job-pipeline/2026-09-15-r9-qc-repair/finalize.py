import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r9-qc-repair-20260915'
BASE = OUT.parent / '1.0.0-r8-reliability-20260914'
read = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = read(OUT / 'package-verification.json')
assert sha(OUT / 'pellmoor-job-pipeline.zip') == manifest['zip_sha256']
for name, digest in manifest['source_sha256'].items():
    assert sha(OUT / 'task/pellmoor-job-pipeline' / name) == digest, name
    assert sha(ROOT / 'projects/pellmoor-job-pipeline' / name) == digest, name
baseline = read(BASE / 'package-verification.json')
assert sha(BASE / 'pellmoor-job-pipeline.zip') == baseline['zip_sha256']
run_hashes = read(BASE / 'run-file-hashes.json')
run_root = ROOT / 'run-outputs/pellmoor-job-pipeline'
assert {p.relative_to(run_root).as_posix() for p in run_root.rglob('*') if p.is_file()} == set(run_hashes)
assert all(sha(run_root / name) == digest for name, digest in run_hashes.items())
groups = read(HERE / 'golden-validation/batch-regressions.json')['results']
assert len(groups) == 14 and all(g['status'] == 'passed' for g in groups)
execution = read(HERE / 'golden-validation/execution-status.json')
assert execution['exit_code'] == 0
provenance = read(HERE / 'golden-validation/runner-logs/prompt-provenance.json')
assert provenance['runner_sha256'] == manifest['source_sha256']['tests/test.sh']
assert provenance['reward_config_sha256'] == manifest['source_sha256']['tests/reward.toml']
assert provenance['runtime_seed_sha256'] == manifest['seed_sha256']
for dim, values in provenance['judges'].items():
    assert values['prompt_sha256'] == manifest['source_sha256'][f'tests/{dim}/prompt.md']
    assert values['judge_sha256'] == manifest['source_sha256'][f'tests/{dim}/judge.toml']
for name, digest in provenance['support_files'].items():
    assert digest == manifest['source_sha256']['tests/' + name]
gate = read(HERE / 'gate-validation/results.json')
gate_cases = [r for r in gate['results'] if 'gate_passed' in r['result']]
assert gate['passed'] and len(gate_cases) == 6
assert sum(bool(r['result']['gate_passed']) for r in gate_cases) == 4
seed = read(HERE / 'gate-validation/seed-preservation.json')
assert seed['seedFieldsPreserved'] and seed['pimNotesRemainEmpty']
runtime = read(HERE / 'runtime-final/results.json')
assert len(runtime['results']) == 11 and all(r['passed'] for r in runtime['results'])
guards = read(HERE / 'packaging-guard-results.json')
assert guards['final_archive_passed'] and len(guards['results']) == 4 and all(r['passed'] for r in guards['results'])
standard, upload = read(OUT / 'standard-qc.json'), read(OUT / 'upload-qc.json')
assert standard['passed'] and upload['passed'] and upload['sha256'] == manifest['zip_sha256']
images = {dimension: read(HERE / f'image-builds/{dimension}-status.json') for dimension in ('environment', 'tests')}
assert all(image['zip_sha256'] == manifest['zip_sha256'] for image in images.values())
rubric = read(HERE / 'rubric-review.json')
assert rubric['current_judge']['sha256'] == manifest['source_sha256']['tests/functional/judge.toml']
rubric['final_zip_binding'] = {'sha256': manifest['zip_sha256'], 'path': str(OUT / 'pellmoor-job-pipeline.zip')}
(HERE / 'rubric-review.json').write_text(json.dumps(rubric, indent=2) + '\n')
validation = {
    'zip_sha256': manifest['zip_sha256'],
    'local_checks_passed': True,
    'source_files_and_runtime_provenance_match_frozen_package': True,
    'counts': {'golden_workflow_groups': 14, 'actual_mcp_golden_write_cases': 4, 'actual_mcp_negative_write_fixtures': 2, 'actual_runtime_synthetic_score_cases': 11, 'negative_packaging_fixtures': 4, 'standard_checks': len(standard['checks']), 'archive_checks': len(upload['checks'])},
    'golden_execution': execution,
    'image_builds': images,
    'exact_images_verified': all(image['status'] == 'passed' for image in images.values()),
    'fresh_platform_qc': False,
    'fresh_hosted_oracle': False,
    'hosted_judge_and_solver_timing_verified': False,
    'uploaded_run_files_unchanged': len(run_hashes),
    'r8_archive_unchanged': True,
    'checker_sha256': {name: sha(ROOT / f'references/task-templates/check-{name}.py') for name in ('standard', 'upload')},
    'notes': ['Synthetic scoring boundary values and illustrative weighting scenarios are not model results.', 'The 57.2-second local workflow run excludes hosted judge reasoning and solver implementation time.', 'The P/V gate harness tested the same unchanged golden source and prerequisite wording before archive freeze; full runner provenance was verified against the frozen archive.']
}
(OUT / 'VALIDATION.json').write_text(json.dumps(validation, indent=2) + '\n')
manifest['validation'] = validation
(OUT / 'package-verification.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'zip_sha256': manifest['zip_sha256'], 'local_checks_passed': True, 'counts': validation['counts'], 'exact_images_verified': validation['exact_images_verified'], 'fresh_hosted_oracle': False}, indent=2))
