import json
import shutil

from build_submission import HERE, OUT, TASK, RUNS, sha, tree_hashes, load_evidence, build_job_zips, build_eval, build_case, expected_names

audit_path = HERE / 'package-audit.json'
audit = json.loads(audit_path.read_text())
assert tree_hashes(OUT) == audit['files']
task_before = tree_hashes(TASK)
runs_before = tree_hashes(RUNS)
records, nop = load_evidence()
backup = HERE / 'haiku-pending-draft'
backup.mkdir(exist_ok=False)
shutil.copy2(audit_path, backup / 'package-audit.json')
names = ['brickfall-breaker-arcade-claude-haiku-4.5-job-directory.zip',
         'CASE-STUDY-brickfall-breaker-arcade.docx', 'EVAL-REPORT-brickfall-breaker-arcade.docx']
for name in names:
    p = OUT / name
    assert p.resolve().parent == OUT.resolve()
    assert sha(p.read_bytes()) == audit['files'][name]
    shutil.move(str(p), str(backup / name))
for p in sorted(HERE.glob('*.pdf')):
    assert p.stem in ['CASE-STUDY-brickfall-breaker-arcade', 'EVAL-REPORT-brickfall-breaker-arcade']
    shutil.move(str(p), str(backup / p.name))
jobs, secret_count = build_job_zips({'claude-haiku-4.5': records['claude-haiku-4.5']})
build_eval(records, nop)
build_case(records)
assert sorted(p.name for p in OUT.iterdir()) == expected_names()
assert tree_hashes(TASK) == task_before
assert tree_hashes(RUNS) == runs_before
audit['files'] = tree_hashes(OUT)
audit['job_archives']['claude-haiku-4.5'] = jobs['claude-haiku-4.5']
audit['haiku_status'] = 'Completed run-05fd6dc8 / gJZNsAw; overall 0.1689; Functional 0.0870, 2/25; both gates pass'
audit['recorded_scores'] = {k: r['rewards'] for k, r in records.items()}
audit['provider_credential_values_redacted'] = secret_count
audit['haiku_replacement'] = {'original_pending_delivery_preserved_in': str(backup),
                            'source_exports_unchanged': True, 'new_trial': records['claude-haiku-4.5']['result']['trial_name']}
audit.pop('final_validation', None)
audit_path.write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps({'haiku_status': audit['haiku_status'], 'haiku_file_count': jobs['claude-haiku-4.5']['file_count'], 'files': audit['files']}, indent=2))
