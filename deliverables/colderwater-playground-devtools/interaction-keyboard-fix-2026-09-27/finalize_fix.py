"""Bind the two reported fixes and explicitly reused evidence to this upload."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import tomllib

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root / 'projects/colderwater-playground-devtools'
prior = out.parent / 'cross-check-2026-09-27'
full = out.parent / 'full-qc-2026-09-27'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(name, data):
    (out / name).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

candidate = read(out / 'candidate_manifest.json')
files = candidate['source_sha256']
assert sha(out / candidate['archive']) == candidate['sha256']
assert {p.relative_to(task).as_posix(): sha(p) for p in task.rglob('*') if p.is_file()} == files
delta = read(out / 'change_scope.json')
assert delta['passed'] and delta['source_hashes'] == files
for name in ['source_audit.json', 'extracted_source_audit.json']:
    proof = read(out / name)
    assert (proof['passed'], proof['failed']) == (90, 0)
    assert proof['source_hashes'] == files
images = read(out / 'final_image_evidence.json')
assert images['passed'] and images['source_unchanged_during_build']
assert images['source_before_build'] == {k: v for k, v in files.items() if k.startswith(('environment/', 'tests/'))}
keyboard = read(out / 'keyboard-proof-results.json')
assert keyboard['passed'] and not keyboard['pageErrors'] and len(keyboard['checks']) == 5
assert all(c['passed'] for c in keyboard['checks'])
for path, digest in keyboard['checks'][0]['hashes'].items():
    assert files['solution/app/public' + path] == digest
keyboard_binding = read(out / 'keyboard-evidence-binding.json')
assert keyboard_binding['passed'] and keyboard_binding['build_inputs_and_outputs_match_task'] and keyboard_binding['served_assets_match_build_and_task']
assert keyboard_binding['current_solution_hashes'] == {k: v for k, v in files.items() if k.startswith('solution/')}
assert keyboard_binding['proof_result_sha256'] == sha(out / 'keyboard-proof-results.json')
timer = read(out / 'interaction-mcp-results.json')
assert timer['passed'] and timer['observations']['passed']
assert len(timer['observations']['observations']) == 5
assert all(c['passed'] for c in timer['observations']['observations'])
assert timer['source_binding']['src/runtime.ts'] == files['solution/app/src/runtime.ts']
for path, digest in timer['source_binding'].items():
    assert files['solution/app/' + path] == digest
language = read(out / 'language-mcp-results.json')
assert language['passed'] and language['observations']['passed']
assert len(language['observations']['observations']) == 1
late = language['observations']['observations'][0]
assert late['passed'] and late['wait_after_observed_completion_ms'] >= 6000 and late['focused_input_wait_before_typing_ms'] >= 6000
assert late['late_handler_entries'] == {'click': 1, 'keyboard': 1, 'input': 1}
assert not late['css_preserved_handler'] and late['new_js_global'] == 'undefined'
for path, digest in language['source_binding'].items():
    assert files['solution/app/' + path] == digest
assert (out / 'FOCUSED_INDEPENDENT_REVIEW.md').exists()
old_files = read(prior / 'candidate_manifest.json')['source_sha256']
reused_harness = ['tests/test.sh', 'tests/tools/restart_mcp.py', 'tests/tools/score.py', 'tests/scoring.toml']
assert all(files[p] == old_files[p] for p in reused_harness)
for name in ['restart_fixed_probe_results.json', 'harness_regression_results.json']:
    proof = read(prior / name)
    assert proof['passed'] and proof['test_sh_sha256'] == files['tests/test.sh']
score = read(prior / 'scoring-results.json')
assert (score['passed'], score['failed']) == (20, 0) and score['source_sha256'] == files['tests/tools/score.py']
binding = {
    'candidate_sha256': candidate['sha256'], 'baseline_sha256': delta['baseline_sha256'],
    'changed_files': delta['changed_files'], 'removed_files': delta['removed_files'], 'added_files': delta['added_files'],
    'unchanged_files': delta['unchanged_files'], 'source_and_extraction_assertions': [90, 90],
    'current_images_exact_source_match': True, 'fresh_keyboard_groups': 5, 'fresh_actual_mcp_interaction_groups': 5,
    'expanded_language_fixture_recheck_passed': True,
    'criterion_descriptions_changed': delta['criterion_descriptions_changed'],
    'all_ids_weights_types_order_and_scoring_preserved': True,
    'golden_delta': 'Only app.tsx footer text and aria-describedby, rebuilt JS asset, and public index asset link changed. Runtime, server, styles, dependencies, installer and examples are unchanged.',
    'reused_evidence': {
        'prior_harness': 'Five restart lifecycle controls, four orchestration controls and golden browser restart from ../cross-check-2026-09-27; exact test.sh/shared-tool hashes match.',
        'prior_scorer': '20 synthetic cases from ../cross-check-2026-09-27; exact score.py and scoring.toml match.',
        'prior_app': 'Earlier criterion observations are retained for unchanged app behavior. Changed keyboard flow, help layout and interaction proof have new final-bundle tests. The help-only source delta is recorded in golden-help.diff.',
        'privacy': 'The privacy description/protocol is unchanged from d254; earlier seven actual-MCP fixtures and21 observations remain scoped evidence, not a rerun.',
    },
    'oracle_measured': False, 'target_model_measured': False,
}
write('final_candidate_binding.json', binding)

findings = read(prior / 'qc_final_findings.json')
findings['scope'] = 'Focused repair of two platform-reported semantic failures, independent changed-contract review, fresh keyboard/interaction browser proofs, current-source/extraction/image checks. Unchanged53/48 review entries and harness/application evidence explicitly carried forward; no private platform checkers or paid Oracle/model run.'
findings['candidate'] = candidate
findings['evidence_binding'] = binding
findings['resolved_in_this_fix'] = [
    {'id': 'instruction_is_achievable_and_unambiguous_in_the_environment', 'issue': 'Initial Run deadline was ambiguous for later interactions in a completed preview.', 'repair': 'Public notes, shared context and Functional prompt now distinguish completed interaction starts, pending deadlines and static rollback. Delayed positive click and interaction timeout/recovery are observed.'},
    {'id': 'dimensions_cover_every_graded_requirement', 'issue': 'Three Tab stops and command shortcuts did not cover keyboard example/library navigation.', 'repair': 'Polish now follows a bounded pointer-free editor/example/own-library/editor route. Golden documents its working escape sequence; all shared instructions permit the dedicated setup record.'},
    {'id': 'dimension_prompts_are_accurate_and_consistent', 'issue': 'During the repair, shared app_context still prohibited Polish record creation.', 'repair': 'Permit one dedicated harmless Polish setup record; preserve all existing records and Visual read-only behavior.'},
]
updates = {
    'instruction_is_a_natural_product_request': 'The added paragraph explains leaving a successful preview open before clicking or typing, and protecting unfinished work. It uses product language rather than criterion names or fixture constants.',
    'instruction_preserves_natural_human_voice': 'New owner-facing prose uses concrete reasons and ordinary contractions; the rest of the brief and notes is unchanged.',
    'instruction_is_achievable_and_unambiguous_in_the_environment': 'The previous conclusion missed the screenshot counterexample and is superseded. Run, pending callbacks, completed-current-preview interaction, timeout/Stop/replacement and static restored snapshots are now distinguished across public notes, shared context and Functional prompt. Five actual-MCP groups plus the expanded exact language fixture prove the relevant golden transitions. See FOCUSED_INDEPENDENT_REVIEW.md, interaction-mcp-results.json and language-mcp-results.json.',
    'instruction_leaks_no_grader_machinery': 'Fresh source and extracted-archive scans pass criterion-ID and grader-vocabulary guards after public wording changes. The new six-second diagnostic markers are confined to verifier files.',
    'solution_covers_every_deliverable': 'Golden runtime/server behavior is unchanged; app.tsx adds a visible Escape-then-Tab hint and accessible description. Pinned rebuild, served asset hashes and five fresh keyboard/help-layout groups prove the delivered bundle contains the change.',
    'solution_covers_every_graded_dimension': 'Changed keyboard and interaction behaviors have five fresh groups each. Unchanged45-criterion application evidence is explicitly reused by scope in GOLDEN_CRITERION_EVIDENCE.json. Aesthetic judgment and complete paid Oracle remain unmeasured.',
    'solution_is_frozen_and_deterministic': 'Current manifest, source/extraction90-assertion reports, change_scope.json and rebuilt-image hashes bind all50 files. Only the documented help change affects golden files; new JS asset and index reference match served content.',
    'timeouts_fit_the_work': 'Canonical nesting remains600+600<1500 and9000+900+900<11100<13200 combined with gates. New late-action and interaction-budget waits are bounded and were locally executed. Full33-criterion paid judge duration remains unmeasured.',
    'dimensions_cover_every_graded_requirement': 'The prior keyboard coverage conclusion missed mouse-only examples/library and is superseded. Polish now observes actual pointer-free navigation through editor escape, an example and its own saved record, with return and visible focus. Functional retains command shortcuts. Added interaction-budget witnesses cover the clarified lifecycle. Exact backend engine and exhaustive security remain bounded-coverage notes.',
    'no_criterion_grades_the_unrequired': 'Late successful-preview interactions and the shared interaction deadline are now explicit public requirements. Keyboard navigation was already public. The probe permits native/documented keys, normal keyboard warning handling, disabled controls and static rollback; it demands no binding, layout or live restored handlers.',
    'criteria_are_independent_and_noncontradictory': 'Polish owns pointer-free operability, not execution/shortcut semantics or data durability. The dedicated save is preparation, independent of other judges. Functional language dispatch observes delayed successful HTML interactivity/CSS isolation; recovery observes the separate bounded failure/rollback outcome. Shared context now permits the Polish setup and keeps Visual read-only.',
    'negative_checks_have_positive_controls': 'The interaction-budget probe starts with completed successful HTML and a working handler, observes a second click while pending, then verifies timeout, rollback, no six-second late marker and a fresh saved Run. Existing negative controls remain unchanged.',
    'plural_asks_are_checked_across_all_matches': 'The newly explicit keyboard route includes both examples and the saved library rather than only three controls. Actual interaction proof covers delayed click plus keyboard/input, pending non-extension, Stop and replacement. Existing other plural checks are unchanged.',
    'criteria_are_outcome_based_and_browser_decidable': 'Fresh keyboard trace uses actual key events after setup, without programmatic focus/click/API shortcuts. Actual installed MCP executes the delayed-click and timeout/recovery observations. Dedicated library setup and ordinary warning handling avoid unavailable browser operations or prior-judge identity dependencies.',
    'criterion_description_is_self_consistent': 'Shared context, changed prompts and criteria agree on permissible Polish setup, keyboard-only navigation, completed-current-preview interaction budgets, pending non-extension and static restored snapshots. Independent reviewer caught and resolved the inherited no-Polish-write contradiction.',
    'interactive_time_varying_and_viewport_behavior_is_exercised': 'New proof waits beyond five seconds after observed completion before clicking. A six-second timer plus a second click about two seconds into pending work distinguishes incorrect deadline reset.31 actual key events prove navigation. Updated help text fits both themes at desktop/mobile widths.',
    'later_dimensions_tolerate_earlier_mutations': 'Polish prepares one independently named harmless record and preserves existing records. It permits an initially empty library and does not depend on gate/Functional identities. Shared context authorizes this setup; Visual remains read-only.',
    'dimension_and_criterion_weights_are_honest': 'All criterion IDs, types, order and weights are unchanged:33 Functional/49.5,4 Polish/4,6 Visual/6. Dimension60/20/20 and floor are unchanged. Stronger existing keyboard coverage can deduct0.05 overall; weight preservation is not a promise of identical model scores.',
    'dimension_prompts_are_accurate_and_consistent': 'Both changed prompts and injected app_context agree with the public lifecycle and keyboard scope. Shared setup-write contradiction was explicitly fixed. Static restored snapshots remain permitted; Visual gains no functional interaction requirements.',
    'cross_file_runtime_contract_is_consistent': 'Current source/extraction each pass90 assertions; delta checks preserve config, timeouts, IDs, weights and canonical scoring. Actual rebuilt images match seven public inputs and15 verifier files. Source and manifest agree on the new50-file ZIP.',
}
for check in findings['tasks'][0]['checks']:
    if check['id'] in updates:
        check['evidence'] = updates[check['id']]
    else:
        check['evidence'] = 'Carried forward for unchanged scope from ../cross-check-2026-09-27/qc_final_findings.json: ' + check['evidence'].split(' Review binding:')[0]
    check['evidence'] += ' Current binding: final_candidate_binding.json; focused review and measured limits: QC_FINAL.md.'
for check in findings['deterministic']:
    check['note'] = 'Current source/extraction each pass90 local assertions; images/manifest match. Unchanged documented manual disposition is carried from ../cross-check-2026-09-27/. Official private checker implementation was not available or executed. See final_candidate_binding.json.'
write('qc_final_findings.json', findings)
assert len(findings['tasks'][0]['checks']) == 53 and len(findings['deterministic']) == 48
quality = dict(Counter(c['verdict'] for c in findings['tasks'][0]['checks']))
deterministic = dict(Counter(c['status'] for c in findings['deterministic']))

mapping = read(full / 'GOLDEN_CRITERION_EVIDENCE.json')
mapping['archive_sha256'] = candidate['sha256']
mapping['scope'] = 'Mixed reused unchanged observations and fresh affected-flow proofs; not a rerun of all45 criteria or a paid Oracle.'
mapping['rubric_sha256'] = {p: digest for p, digest in files.items() if p.endswith('/judge.toml')}
mapping['fresh_vs_historical'] = binding['reused_evidence']
for c in mapping['criteria']:
    c['evidence'] = ['../full-qc-2026-09-27/' + p for p in c['evidence']]
    c['evidence_scope'] = 'Reused for unchanged behavior; see final_candidate_binding.json.'
    if c['id'] in ['language_dispatch', 'recovery_persistence_chain']:
        c['evidence'].append('interaction-mcp-results.json')
        if c['id'] == 'language_dispatch':
            c['evidence'].append('language-mcp-results.json')
        c['evidence_scope'] = 'Fresh full affected flow through installed MCP on the final packaged golden bundle.'
        c['observations'] += ' New completed-preview and pending-interaction legs passed; see fresh five-group proof.'
    elif c['id'] == 'labelled_controls_and_focus':
        c['evidence'] = ['keyboard-proof-results.json', 'KEYBOARD_RECHECK.md']
        c['evidence_scope'] = 'Fresh exact final-bundle keyboard route and visible focus.'
        c['observations'] = 'Own independent UI-save setup;31 key events through editor escape, native example selection, main enabled controls, own library load and return. No route writes or page errors.'
    elif c['id'] == 'cw_process_restart_durability':
        c['evidence'].append('../cross-check-2026-09-27/harness_golden_browser_restart.log')
    elif c['id'] == 'cw_runtime_files_not_publicly_exposed':
        c['evidence'].append('../cross-check-2026-09-27/privacy-redirect-summary.json')
mapping['explicit_gaps'].append('No full paid judge execution for this candidate; unchanged prior observations are retained, not relabelled fresh. Changed keyboard and interaction flows ran on the final golden bundle.')
write('GOLDEN_CRITERION_EVIDENCE.json', mapping)

summary = f'''# Colderwater interaction and keyboard fixes

Both reported source-level defects are corrected. The earlier local review missed the ambiguous completed-preview lifetime and the mouse-only navigation counterexample; its affected conclusions are superseded. This report does not establish platform acceptance or Oracle 1.0.

## Upload

- [Replacement ZIP](colderwater-playground-devtools.zip): `{candidate['sha256']}`.
- {candidate['files']} files, {candidate['bytes']} bytes; one root; verified CRC, paths, extraction hashes and executable LF shell files.
- Supersedes immutable `d254c73e6ebe…` in `../cross-check-2026-09-27/`.
- Nine existing paths changed and one built JS asset was replaced. Forty files are byte-identical. [Exact delta](change_scope.json).

## Repairs

1. The public notes now say a successfully completed current preview remains interactive. A later deliberate action gets a new five-second budget; interactions and callbacks during pending work do not extend that budget. Stop/error/replacement invalidate old execution, and rollback may restore a static picture. The shared judge context and Functional prompt agree. The language probe waits beyond completion before clicking and typing; recovery also observes the pending interaction deadline and absent late callback.
2. Polish now tests a bounded keyboard route through the editor, examples and its own saved snippet. Normal/documented keys, keyboard-handled warnings and disabled controls are accommodated. Its setup preserves existing records; shared instructions explicitly permit that one save. Functional still owns Run/Save/Clear shortcut behavior, and Visual remains read-only.
3. The golden displays and exposes to assistive technology its existing “Escape, then Tab” editor escape. Only help text/accessible linkage and its rebuilt bundle changed. Runtime, server, styles, dependencies and installer are unchanged.

## Executed evidence

| Check | Result |
| --- | --- |
| Source/extracted source assertions | 90/90 each |
| Intended file/config/criterion delta | Passed; IDs/types/order/weights preserved |
| Golden keyboard/help proof | 5/5 groups; 31 key events; zero page errors |
| Actual installed-MCP interaction proof | 5/5 groups plus expanded exact language fixture on final golden bundle |
| Agent/verifier image contents | Exact 7 public inputs / 15 verifier files |
| Archive/current source hashes | 50/50 matched |
| 53 quality dispositions | {quality}; unchanged scopes explicitly carried forward |
| 48 documented deterministic dispositions | {deterministic}; local/manual equivalents |

Read [independent focused review](FOCUSED_INDEPENDENT_REVIEW.md), [keyboard proof](KEYBOARD_RECHECK.md), [interaction proof](interaction-mcp-results.json), [expanded language proof](language-mcp-results.json), [current binding](final_candidate_binding.json) and [criterion evidence index](GOLDEN_CRITERION_EVIDENCE.json). The old harness/scorer/privacy and unchanged product witnesses remain linked with their original scope. They were not rerun or relabelled as fresh. Both changed-flow proofs used the exact final golden bundle. The initial MCP driver's modal-handling failure is retained as diagnostic history and does not describe a product failure.

## Scores and remaining limits

All 33 Functional criteria retain total weight 49.5; four Polish and six Visual criteria retain their weights. The 60/20/20 formula, functional floor, gates, models and timeouts are unchanged. The changed keyboard criterion contributes 0.05 overall reward; the two changed Functional criteria together contribute `0.6 × 5 / 49.5 ≈ 0.0606`. These are conditional contribution bounds with the same gate/floor outcome, not predicted score changes. Floor crossings must be considered separately.

There is no new measured Oracle or target-model score. Local golden observations passed the affected checks, but complete paid judging, subjective aesthetics, full-suite timing and the platform's private checkers remain unmeasured. The earlier provisional 0.55–0.75 functioning-model estimate is not validated by this repair. No guarantee of Oracle 1.0 or a model score below 0.7 is made. No paid call, commit, push or platform upload was performed.
'''
(out / 'QC_FINAL.md').write_text(summary, encoding='utf-8')
print(json.dumps({'candidate': candidate['sha256'], 'quality': quality, 'deterministic': deterministic, 'bindings_passed': True}))
