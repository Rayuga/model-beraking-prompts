"""Merge scoped independent reviews with executed Ridgeline artifact evidence."""
import hashlib
import json
import tomllib
from collections import Counter
from pathlib import Path

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root / 'projects/ridgeline-print-storefront'
previous = out.parent / 'rubric-followup-2026-09-26'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(name, data):
    (out / name).write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

candidate = read(out / 'candidate_manifest.json')
old = read(previous / 'candidate_manifest.json')
files = candidate['source_sha256']
assert set(files) == set(old['source_sha256'])
changed = sorted(k for k in files if files[k] != old['source_sha256'][k])
assert changed == ['task.toml', 'tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md', 'tests/scored/polish/judge.toml', 'tests/scored/polish/prompt.md', 'tests/test.sh']
assert {p.relative_to(task).as_posix(): digest(p) for p in task.rglob('*') if p.is_file()} == files
assert digest(out / candidate['archive']) == candidate['sha256']
for name in ['source_audit.json', 'extracted_source_audit.json']:
    proof = read(out / name)
    assert (proof['passed'], proof['failed']) == (89, 0) and proof['source_hashes'] == files
golden = read(out / 'golden-archive-identity.json')
assert len(golden['solution_files']) == 19
assert all(files['solution/' + k] == h for k, h in golden['solution_files'].items())
for name in ['restart_fixed_probe_results.json', 'harness_regression_results.json']:
    proof = read(out / name)
    assert proof['passed'] and proof['test_sh_sha256'] == files['tests/test.sh']
restart = read(out / 'browser_restart_results.json')
assert restart['passed'] and restart['process_restart']['old_pid'] != restart['process_restart']['new_pid']
scorer = read(out / 'scoring-results.json')
assert (scorer['passed'], scorer['failed']) == (20, 0)
images = read(out / 'final_image_evidence.json')
assert images['passed'] and images['source_unchanged_during_build']
assert images['source_before_build'] == {k: h for k, h in files.items() if k.startswith(('environment/', 'tests/'))}
assert all(files[k] == h for k, h in read(out / 'semantic-source-binding.json').items())
arithmetic = read(out / 'semantic-arithmetic-results.json')
assert arithmetic['passed'] and len(arithmetic['arithmetic_cases']) == 18
counts = {}
for name in ['commerce/results.json', 'commerce/remaining-ui-legs-results.json', 'conditional/results.json', 'presentation/browser-criteria-results.json', 'gate-address/gate-address-browser-results.json']:
    proof = read(out / name)
    assert proof['passed'] and all(c['passed'] for c in proof['checks'])
    assert not proof.get('pageErrors') and not proof.get('browser_errors')
    counts[name] = len(proof['checks'])
assert counts == {'commerce/results.json': 13, 'commerce/remaining-ui-legs-results.json': 4, 'conditional/results.json': 1, 'presentation/browser-criteria-results.json': 45, 'gate-address/gate-address-browser-results.json': 7}
assert (out / 'GOLDEN_RECHECK.md').exists()
criterion_map = read(out / 'GOLDEN_CRITERION_EVIDENCE.json')
assert criterion_map['archive_sha256'] == candidate['sha256']
assert all(files[k] == h for k, h in criterion_map['rubric_sha256'].items())
actual_ids = {c['id'] for p in (task / 'tests').glob('*/*/judge.toml') for c in tomllib.loads(p.read_text(encoding='utf-8'))['criterion']}
assert len(criterion_map['criteria']) == len(actual_ids) == 37
assert {c['id'] for c in criterion_map['criteria']} == actual_ids
assert all(c['observation'] and c['evidence'] and all((out / p).is_file() for p in c['evidence']) for c in criterion_map['criteria'])
binding = {'candidate_sha256': candidate['sha256'], 'previous_sha256': old['sha256'], 'changed_files': changed, 'unchanged_files': 45, 'golden_files_hash_matched': 19, 'source_and_extracted_assertions': [89, 89], 'public_image_files': 12, 'verifier_image_files': 15, 'browser_groups': counts, 'restart_lifecycle_cases': 5, 'harness_cases': 4, 'actual_browser_process_restart': True, 'synthetic_score_cases': 20, 'independent_monetary_cases': 18, 'oracle_measured': False, 'target_model_measured': False, 'reuse_scope': 'The entire golden/installer matches the 7502 archive. Fresh browser/restart observations apply to unchanged app bytes; previous detailed backend/installer/catalogue evidence is reused only for unchanged scope. Prior rubric hashes and PASS claims are historical, not relabelled.'}
write('final_candidate_binding.json', binding)

findings = read(out / 'qc_semantic_findings.json')
prior = read(previous / 'qc_final_findings.json')
findings['scope'] = 'Independent requirements-first semantic review plus root source/extraction/image checks, harness regression and fresh golden browser evidence. Every53/48 entry has a scoped disposition. Private platform executables and paid judging were not run.'
findings['candidate'] = candidate
findings['evidence_binding'] = binding
findings['resolved_findings'] = findings['tasks'][0].pop('findings')
findings['resolved_findings'].append({'id': 'ridgeline-false-restart-success', 'status': 'corrected', 'run_verdict': 'CONFIRMED', 'evidence': 'Old SIGTERM-resistant server stayed live while replacement crashed; fixed actual MCP lifecycle cases and storefront restart pass.', 'action': 'Bounded old-group termination and replacement PID liveness, canonical Python unchanged.'})
findings['tasks'][0]['findings'] = []
patches = {
    'timeouts_fit_the_work': ('Note', 'Numerical budgets pass: gates600+600<1500; scored9000+900+900<11100; suites12600<13200. Five restart lifecycle probes fit the55-second MCP limit. Full paid25-criterion judge duration and cold-cache build envelope remain unmeasured.'),
    'dockerfile_builds_the_declared_world': ('Pass', 'Both final images built successfully. final_image_evidence.json checks actual runtime/public inputs and exactly12 public and15 verifier files against frozen source. Agent app contains only initialization scaffolding; no golden/tests.'),
    'solution_covers_every_deliverable': ('Pass', 'GOLDEN_RECHECK.md maps the final37 criteria and public deliverables to detailed observations. Fresh13commerce+7gate/address+4remainingUI+45presentation groups and actual browser restart passed; unchanged golden/installer hashes permit explicitly scoped prior backend/installer evidence.'),
    'solution_covers_every_graded_dimension': ('Note', 'Golden local observations support all requested behaviors, including both new sold-out-cheapest setup paths and all37 criterion mappings. This is not a paid full Oracle or measured six-topic aesthetic verdict; see GOLDEN_RECHECK.md.'),
    'solution_honors_the_runtime_contract_and_is_self_contained': ('Pass', 'Reviewed solve.sh exact closed-database reset and shipped built-app copy. All19 solution files match prior executed installer evidence. Fresh unprivileged app starts, app-CWD control and actual browser process restart preserve receipts, attempts, stock and cancellation terminality without startup installs.'),
    'verifier_entrypoint_is_safe_and_always_scores': ('Pass', 'HARNESS_REVIEW.md confirms initial zero/EXIT guarantees, sanitized unprivileged launch, symlink boundary, ordered suites and canonical scoring. Four orchestration controls pass; five actual MCP lifecycle probes reject failed replacements and retained listeners. Fresh storefront browser restart passed on exact d983554c helper.'),
    'verifier_image_can_launch_and_grade': ('Note', 'Actual final verifier build/file hashes, Chromium152.0.7977.8 and installed MCP browser/restart execution pass. Judge-provider authentication and live paid grading remain unexercised; synthetic orchestration scores are not Oracle results.'),
    'verifier_and_instruction_agree_on_the_runtime_contract': ('Pass', 'Public integration note states app entry/CWD, port,health,DB_PATH and local backend. Both launches retain those facts. Repaired restart shell changes only process lifecycle verification; canonical Python/helpers/environment are identical to the template. Relative-CWD and golden harness controls pass.'),
    'grader_probes_are_not_pre_satisfied': ('Pass', 'Read every criterion and seed. The only fixed historical order RP-100001 is an explicit read-only control. New writes require observed fresh attempts, chosen address values, actual requests, new references and fresh stock differences; seed-only display cannot satisfy those actions. Search strings are intended seeded read targets, not unperformed write sentinels.'),
    'gates_apply_before_shaping_and_carry_no_reward_mass': ('Pass', 'Actual20 synthetic canonical scorer fixtures include failed gates,missing/invaliddimensions,strictfloor and shapedoutputs. Four orchestration cases show failed gates skip scored work. Both gates have zero policy weight; Functional60/Polish20/Visual20 unchanged.'),
    'tests_and_key_are_out_of_agent_reach': ('Pass', 'Actual agent image inspection finds no solution/tests; verifier has root-restricted/tests and app launches with env-i as UID65534. Frozen verifier env has placeholders only; no live key is copied into task source or public input. See final_image_evidence.json and HARNESS_REVIEW.md.'),
    'task_folder_holds_only_task_files': ('Pass', 'New ZIP has51 regular unique safe members under one task root. Shared packager and source/extraction89assertions verify closed verifier inventory, CRC, modes/LF and all51source hashes. Reports, databases, caches and test fixtures remain outside upload.'),
    'everything_parses_and_would_run': ('Pass', 'Source/extracted audits parse TOML/JSON, validate LF Bash syntax and schema/paths. Final images build and fresh actual browser/server/harness execution succeeds. A report inventory check is not substituted for those executions.'),
    'task_security_and_secrets': ('Pass', 'Fresh source/extracted scans cover live-key patterns, author paths and placeholders over shipped text including bundled code; manual seed/config review finds no real credentials. Provider references are allowed templates. No probe/output is shipped in the task archive.'),
    'floor_is_low_for_shells_mocks_and_stuffing': ('Note', 'Prior unchanged concrete browser-only/static-order fixtures are rejected by shared-write/clean-context retrieval gates; fresh real golden gate and canonical zeroing cases pass. This is bounded counterexample evidence, not a proof against every possible fake implementation.'),
}
for c in findings['tasks'][0]['checks']:
    if c['id'] in patches:
        c['verdict'], c['evidence'] = patches[c['id']]
    c['evidence'] += ' Final scope/hash binding: QC_FINAL.md and final_candidate_binding.json.'
assert not any(c['verdict'] in ['Fail', 'Not exercised'] for c in findings['tasks'][0]['checks'])
findings['deterministic'] = prior['deterministic']
for c in findings['deterministic']:
    c['output'] = c['output'].replace('83 ', '89 ').replace('24/35', '25/35').replace('24 functional', '25 functional')
    c['note'] += ' Current source/extraction89 assertions, actual final image hashes and independent harness binding support the mechanical facts; new semantic coverage is in SEMANTIC_REVIEW.md. Earlier immutable evidence applies only to unchanged scope.'
write('qc_final_findings.json', findings)
quality = dict(Counter(c['verdict'] for c in findings['tasks'][0]['checks']))
mechanical = dict(Counter(c['status'] for c in findings['deterministic']))
summary = f'''# Ridgeline complete cross-check - 27 September 2026

The separate Ridgeline review is complete. Three issues were corrected: false restart success, duplicated theme-readability deductions, and a missing sold-out-cheapest grid-price case. No unresolved concrete local blocker was found. Private platform acceptance and paid Oracle/model scores remain unmeasured.

## Current artifact

[Replacement ZIP](ridgeline-print-storefront.zip), SHA-256 `{candidate['sha256']}`. It contains 51 files / 701173 bytes with verified CRC, safe single root, shell modes/LF and matching source/extracted hashes. It supersedes the unchanged historical 7502bd9c archive.

Exactly six task files changed: task.toml, tests/test.sh, Functional judge/prompt and Polish judge/prompt. All 19 golden/installer files and all public inputs are unchanged. Functional is now 25 criteria / weight 35, with 37 criteria overall. Canonical 60/20/20 shares, floor, runtime contract, shared Python and Dockerfiles remain unchanged.

## Findings and repairs

- **Restart:** the old process ignored shutdown and kept answering while the replacement crashed. The task helper now establishes old-group termination and replacement liveness; five real MCP controls and a fresh storefront process restart pass. [Harness review](HARNESS_REVIEW.md).
- **Presentation ownership:** Polish tests working theme changes and navigation. Visual owns contrast/readability. This removes a duplicate deduction without changing checkout or stock rules.
- **Price coverage:** the initial seed could not expose a grid that priced only available editions. A separate 0.1-weight criterion now checks Slack Water at A3=0/A2>0 and requires the requested GBP 37.95 grid price. It has an independent setup if concurrency did not exhaust A3, leaves A2 for its own checkout, and is funded by reducing catalogue details from 0.4 to 0.3. Both setup paths passed on the unchanged golden. [Semantic review](SEMANTIC_REVIEW.md).

## Validation

| Check | Result |
| --- | --- |
| Full 53-quality review | {quality} |
| All 48 mechanical procedures, local/manual equivalents | {mechanical} |
| Final source / extracted source | 89/89 each |
| Restart lifecycle / orchestration | 5/5 and 4/4 |
| Actual storefront browser process restart | Passed: observed replacement, receipts, retries, cancellations and all 13 stock quantities |
| Fresh commerce / remaining UI legs | 13/13 and 4/4 |
| Shared-order gate and incomplete addresses | 7/7 |
| New independent price setup | Passed; normal branch also passes in commerce flow |
| Presentation browser assertions | 45/45; desktop/mobile, both themes; no page errors |
| Independent monetary derivations | 18/18 plus stock-allocation ledger |
| Canonical scorer | 20/20 synthetic inputs, not paid judging |
| Final images | Exact 12 public / 15 verifier file hashes match |

The semantic reviewer read public requirements before the rubric and both QC-workbook layers. Root and harness reviewers supplied the executable evidence that semantic-only dispositions left unexercised. [Findings JSON](qc_final_findings.json) answers every check; [candidate binding](final_candidate_binding.json) identifies the final source and reused scopes. [Golden recheck](GOLDEN_RECHECK.md) maps all 37 criterion observations. The separate [independent harness binding](independent_harness_binding.json) reopens the ZIP and verifies actual final image contents. The complete [client-safe workbook](QC_FINAL.xlsx) contains every disposition.

Earlier detailed backend, installer and catalogue evidence is reused only for unchanged app/criterion scope. The golden is byte-identical; prior rubric hashes are historical. New restart, presentation-ownership and conditional price observations have fresh proofs. A failed diagnostic fixture attempt or historical report is not current acceptance evidence.

## Remaining limits and score impact

The quality Notes preserve full paid-judge timing, Oracle/aesthetic assignment, legitimate generated identity/time variation, provider execution, browser-only architecture/exact-photo matching, bounded mock coverage, empirical ranking and remote reproducibility. Source verifies supplied/golden photograph bytes, while a browser judge's exact photo identity judgment lacks embedded trusted thumbnails. No broad security/architecture claim is inferred from normal browser behavior. The private platform checker executables were unavailable, so their documented procedures were applied with local checks/manual review instead.

The generic source helper emits an obsolete required-database-deletion failure; the raw output and [adjudication](GENERIC_AUDIT_INTERPRETATION.md) are preserved. Do not erase persistent state to satisfy that regex.

With fixed passing gates and both versions above the floor, the 0.1 grid-weight split changes reward by at most 0.0017143. Removing the unfair Polish deduction can separately restore up to 0.05. Floor crossings are a separate discontinuity; neither figure predicts target-model reward. Correct process replacement can remove previously unearned persistence credit. Actual Oracle 1.0 and target 0.1-0.7 remain measurement targets, not results.

No paid call, upload, commit or push was made. The current Ridgeline handoff and shared authoring lessons now distinguish this review from Colderwater's separate candidate.
'''
(out / 'QC_FINAL.md').write_text(summary, encoding='utf-8')
print(json.dumps({'candidate': candidate['sha256'], 'quality': quality, 'mechanical': mechanical, 'bindings_passed': True}))
