"""Bind the independent shared-scenario review to exact local artifacts."""
from pathlib import Path
import difflib
import hashlib
import json
import zipfile

root = Path.cwd()
review = root / 'deliverables/colderwater-playground-devtools/structural-review-2026-09-27'
out = review / 'harness'
load = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = load(review / 'staged_candidate.json')
main_audit = load(review / 'source_audit_main.json')
archive_audit = load(review / 'source_audit_archive.json')
payload = load(out / 'draft_payload_sizes_refrozen.json')['results'][1]
cli = load(out / 'draft_schema_cli_results.json')
image = load(out / 'final_verifier_image.json')
archive_path = review / 'review-candidate/colderwater-playground-devtools.zip'
archive_hash = sha(archive_path)
checks = []
def check(name, result, evidence):
    checks.append({'name': name, 'passed': bool(result), 'evidence': evidence})

check('final archive SHA', archive_hash == '7d693e9cde4585aebfc2f1bd1678e8a36b644cbc5e8113def1e606b1c0406823', archive_hash)
with zipfile.ZipFile(archive_path) as archive:
    names = [name for name in archive.namelist() if not name.endswith('/')]
    matching = []
    for relative, expected in manifest['source_sha256'].items():
        candidates = [name for name in names if name == relative or name.endswith('/' + relative)]
        matching.append(len(candidates) == 1 and hashlib.sha256(archive.read(candidates[0])).hexdigest() == expected)
    check('ZIP CRC and all 50 exact source files', archive.testzip() is None and len(names) == 50 and len(matching) == 50 and all(matching), {'file_count': len(names), 'matched': sum(matching)})
check('main and extracted archive mechanical source audits', main_audit['failed'] == archive_audit['failed'] == 0 and main_audit['passed'] == archive_audit['passed'] == 95, {'main_passed': main_audit['passed'], 'archive_passed': archive_audit['passed']})
check('main, archive and staged manifest all-source binding', main_audit['source_hashes'] == archive_audit['source_hashes'] == manifest['source_sha256'], 50)
semantic = {
    'judge': 'tests/scored/functional/judge.toml',
    'prompt': 'tests/scored/functional/prompt.md',
    'context': 'tests/app_context.md',
}
check('final argv proof binds all three semantic files', all(payload[key + '_sha256'] == manifest['source_sha256'][rel] for key, rel in semantic.items()), {key: payload[key + '_sha256'] for key in semantic})
check('final prompt and schema launch locally', all(payload['single_argument_local_launch'][key]['launched'] and payload['single_argument_local_launch'][key]['exit_code'] == 0 for key in ['prompt', 'schema']), {'prompt_bytes': payload['resolved_prompt_utf8_bytes'], 'schema_bytes': payload['response_schema_utf8_bytes']})
check('actual CLI fixtures cover unchanged final criterion schema', cli['passed'] and len(cli['results']) == 3 and cli['functional_count'] == 88 and cli['binding']['draft_judge_sha256'] == payload['judge_sha256'] and cli['binding']['draft_context_sha256'] == payload['context_sha256'], {'results': cli['results'], 'scope': 'Schema transport fixture, not Oracle/product evidence'})
check('actual CLI guard/scorer unchanged in final archive', cli['binding']['test_sh_sha256'] == manifest['source_sha256']['tests/test.sh'] and cli['binding']['score_py_sha256'] == manifest['source_sha256']['tests/tools/score.py'], {key: cli['binding'][key] for key in ['test_sh_sha256', 'score_py_sha256']})
old_prompt = review / 'candidates/9bec05c2155f/colderwater-playground-devtools/tests/scored/functional/prompt.md'
new_prompt = root / manifest['staged_task'] / 'tests/scored/functional/prompt.md'
diff = list(difflib.unified_diff(old_prompt.read_text().splitlines(), new_prompt.read_text().splitlines(), fromfile='schema-fixture prompt', tofile='final prompt', lineterm=''))
changed_lines = [line for line in diff if (line.startswith('+') and not line.startswith('+++')) or (line.startswith('-') and not line.startswith('---'))]
check('CLI reuse scope limited to final Clear-control sentence', len(changed_lines) == 2 and all('Trigger Clear console through its shortcut' in line for line in changed_lines) and 'cannot earn Run-shortcut credit' in new_prompt.read_text(), diff)
check('final verifier image contains exact shipped tests', image['passed'] and image['expected_count'] == image['actual_count'] == 15 and not image['unexpected_files'] and image['manifest_sha256'] == sha(review / 'staged_candidate.json'), {'image_id': image['image_id'], 'matched_files': 15, 'rewardkit': image['rewardkit_version']})

report = {
    'scope': 'Independent bounded source/protocol/harness review. No model, paid provider or platform call; no hosted or full browser-workflow success claim.',
    'reviewed_archive_sha256': archive_hash,
    'semantic_hashes': {key: payload[key + '_sha256'] for key in semantic},
    'checks': checks, 'passed': all(c['passed'] for c in checks),
    'remaining_concrete_blockers_in_this_review': [],
    'resolved_findings': [
        'Initial 160-row resolved prompt exceeded the local single-argument launch limit; final 102689-byte prompt launches.',
        'Fixed baseline marker names now use actual currentLastGood, with one independent fallback when a handoff is unavailable.',
        'S16 existing third Run now supplies a real DOM marker for meaningful theme-preservation evidence.',
        'S31 explicitly reuses freshly read clean Base and creates its own fallback only if unavailable.',
        'S33 server-filename observations have an independent already-saved control if supported import fails.',
        'S35 Clear shortcut can obtain nonempty console setup through manual Run if the Run shortcut fails, without earning Run-shortcut credit.',
    ],
    'workload': {'old_binary_rows': 37, 'new_binary_rows': 88, 'original_weight_conserved': '49.5', 'nominal_old_manual_runs': 60, 'nominal_new_manual_runs': 50, 'control_handoffs': 11, 'added_manual_autorun_on_control': 1, 'timing_measured': False, 'old_resolved_prompt_bytes': 79343, 'new_resolved_prompt_bytes': payload['resolved_prompt_utf8_bytes'], 'old_schema_bytes': 9297, 'new_schema_bytes': payload['response_schema_utf8_bytes']},
    'build': {'image_id': image['image_id'], 'first_attempt': 'Network-none build missed apt cache and failed DNS/package availability; no image success claimed for that attempt.', 'successful_attempt': 'Original/default build network mode reused all apt/npm/pip/browser dependency layers; final COPY/chmod/workdir rebuilt. No provider execution.'},
    'limits': ['A same-call evidence ledger is not a RewardKit checkpoint.', 'Forced waits do not prove overrun of 9000 seconds (150 minutes).', 'Static reductions and fixture serialization do not measure model/tool latency or full browser workflow completion.', 'The source audit is mechanical and does not replace the separate semantic guard or golden/partial-feature execution.'],
}
(out / 'final_shared_review.json').write_text(json.dumps(report, indent=2) + '\n')
assert report['passed'], [c for c in checks if not c['passed']]
print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'archive': archive_hash, 'image': image['image_id']}))
