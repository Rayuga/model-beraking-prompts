"""Resolve the prior review against the clarified scope and packaged bytes."""
import hashlib
import json
import shutil
import tomllib
from pathlib import Path

out = Path(__file__).resolve().parent
root = Path.cwd()
task = root/'projects/ridgeline-print-storefront'
template = root/'projects/webdev-task-template'
previous = out.parent/'full-qc-review-2026-09-28/qc_findings.json'
report = json.loads(previous.read_text(encoding='utf8'))
manifest = json.loads((out/'candidate_manifest.json').read_text())
audit = json.loads((out/'source_audit.json').read_text())
continuation = out.parent/'continuation-fixes-2026-09-28'
probe = json.loads((continuation/'mobile-probe/boundary-observations.json').read_text())
assert probe['passed'] and len(probe['checks']) == 20
assert tomllib.loads((continuation/'mobile-coverage-proposed-judge.toml').read_text()) == tomllib.loads((task/'tests/scored/polish/judge.toml').read_text())
assert audit['failed'] == 0 and audit['source_hashes'] == manifest['source_sha256']
old_hashes = report['evidence_binding']['task_source_hashes']
assert all(old_hashes[p] == h for p,h in manifest['source_sha256'].items() if p.startswith('solution/'))
shared = ['tests/test.sh','tests/scoring.toml','tests/tools/score.py','tests/tools/restart_mcp.py','tests/Dockerfile','environment/Dockerfile','tests/.dockerignore']
for rel in shared:
    assert (task/rel).read_bytes() == (template/rel).read_bytes(), rel
for p in (task/'tests').rglob('judge.toml'):
    assert tomllib.loads(p.read_text())['judge'] == tomllib.loads((template/p.relative_to(task)).read_text())['judge']
assert tomllib.loads((task/'task.toml').read_text())['metadata']['tags'] == tomllib.loads((template/'task.toml').read_text())['metadata']['tags']
updates = {
 'task_identity_is_coherent': ('Pass','Task name and product metadata agree; extra metadata tags have been removed to match the template.'),
 'dimensions_cover_every_graded_requirement': ('Note','The mobile check now explicitly covers catalogue, detail, basket, delivery fields, submission control, lookup and receipt. The exact proposed description is applied; its golden tour passed20 browser assertions. The earlier hidden-mobile-form counterexample is now expressly disallowed. Browser-only evidence still cannot prove invisible framework/database identity.'),
 'interactive_time_varying_and_viewport_behavior_is_exercised': ('Pass','Current mobile tour passes on all required screens at390x844 without purchases. Matching earlier golden evidence covers keys, themes, reload, independent contexts, concurrent purchases and lost-response handling.'),
 'dimension_prompts_are_accurate_and_consistent': ('Pass','Task-specific prompts and grading descriptions are permitted by the user clarification. Current prompts share Ridgeline context and evidence rules; mobile usability belongs to Polish while Visual assesses composition.'),
 'cross_file_runtime_contract_is_consistent': ('Pass','Canonical harness, Dockerfiles, tools, policy and judge headers match template; user clarified task-specific prompt customization is permitted without CHANGE_ME. Current source and extracted release archive hashes agree. Runtime instructions preserve canonical entry/CWD/port/DB_PATH behavior.'),
 'task_folder_holds_only_task_files': ('Pass','Release contains51 task files under one root, closed staged structure, no database/cache/review artifacts. CRC, extraction hashes and executable shell modes pass.'),
}
for c in report['tasks'][0]['checks']:
    if c['id'] in updates:
        c['verdict'],c['evidence'] = updates[c['id']]
        c.update(severity='',finding='',action='',run_verdict='PARTIAL' if c['verdict']=='Note' else 'CONFIRMED')
for d in report['deterministic']:
    if d['name']=='check-canonical-shared-files.py':
        d.update(status='PASS',output='All seven shared files byte-match template, as do judge headers and fixed metadata tags. User clarified that task-specific prompts may change without CHANGE_ME; their customization is no longer treated as a frozen-harness violation.')
    if d['name']=='check-no-stray-files.py':
        d.update(output='Current source and new51-file archive match; CRC, safe root, executable shell modes and all extracted SHA256s pass. Reports remain outside task.')
    if d['name']=='check-instruction-content.py':
        d.update(output='Owner-facing request and notes define product/runtime. The mobile coverage gap is addressed by the expanded existing usability criterion, tested on the golden.')
checks=report['tasks'][0]['checks']
report['tasks'][0]['findings'] = [f for f in report['tasks'][0]['findings'] if f['id']=='F4']
report['scope']='All53 quality and48 static-requirement dispositions updated after user scope clarification and mobile coverage fix. Local evidence, not official platform QC or Oracle certification.'
report['resolved_findings']={
 'F1':'Overbroad freeze interpretation corrected by user clarification; task-specific prompts are editable. Canonical infrastructure and settings verified unchanged; extra tags removed.',
 'F2':'Existing mobile criterion now includes all key surfaces and delivery/submission controls;20 golden browser assertions passed; no weights or golden code changed.',
 'F3':'New archive built and extraction/hash/CRC/mode checks passed; top-level final.zip updated to these exact bytes.'}
report['candidate']=manifest
report['evidence_binding'].update(task_source_hashes=manifest['source_sha256'],task_unchanged_during_review=False,source_changes_since_prior_review=['task.toml metadata.tags','tests/scored/polish/judge.toml responsive_layout description'],mobile_probe=str(continuation/'mobile-probe/boundary-observations.json'),template_comparison='Seven shared files and five judge headers checked directly by finalize_review.py',official_checker_execution=False)
report['evidence_binding']['source_matches_release_archive']=True
report['evidence_binding']['user_clarification']='Task-specific prompts must change even when CHANGE_ME is not present; do not treat that alone as a compliance defect.'
assert len(checks)==53 and len(report['deterministic'])==48
assert not any(c['verdict']=='Fail' for c in checks)
assert not any(d['status']=='FAIL' for d in report['deterministic'])
shutil.copyfile(out/'ridgeline-print-storefront.zip',out.parent/'ridgeline-print-storefront-final.zip')
assert hashlib.sha256((out.parent/'ridgeline-print-storefront-final.zip').read_bytes()).hexdigest()==manifest['sha256']
(out/'qc_findings.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({'local_source_assertions':audit['passed'],'mobile_assertions':20,'unresolved_confirmed_local_findings':0,'full_judge_timing_and_oracle':'not exercised','archive_sha256':manifest['sha256']},indent=2))
