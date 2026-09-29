"""Bind the second review to the repaired candidate; retain earlier evidence scopes."""
import hashlib
import json
from collections import Counter
from pathlib import Path

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root / 'projects/colderwater-playground-devtools'
previous = out.parent / 'full-qc-2026-09-27'

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write_json(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

candidate = read_json(out / 'candidate_manifest.json')
old = read_json(previous / 'candidate_manifest.json')
files = candidate['source_sha256']
assert set(files) == set(old['source_sha256'])
changed = sorted(k for k in files if files[k] != old['source_sha256'][k])
assert changed == ['tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md', 'tests/test.sh'], changed
assert {p.relative_to(task).as_posix(): digest(p) for p in task.rglob('*') if p.is_file()} == files
assert digest(out / candidate['archive']) == candidate['sha256']
for name in ['source_audit.json', 'extracted_source_audit.json']:
    audit = read_json(out / name)
    assert (audit['passed'], audit['failed']) == (90, 0)
    assert audit['source_hashes'] == files

golden = read_json(out / 'golden-archive-identity.json')
assert len(golden['solution_files']) == 23
assert all(files['solution/' + p] == value for p, value in golden['solution_files'].items())
flow = read_json(out / 'golden-flow-results.json')
assert flow['passed'] and not flow['pageErrors'] and len(flow['checks']) == 6
assert all(c['passed'] for c in flow['checks'])
restart = read_json(out / 'restart_fixed_probe_results.json')
harness = read_json(out / 'harness_regression_results.json')
for proof in [restart, harness]:
    assert proof['passed'] and proof['test_sh_sha256'] == files['tests/test.sh']
    assert len(proof['results']) == 5
scorer = read_json(out / 'scoring-results.json')
assert (scorer['passed'], scorer['failed']) == (20, 0)
assert scorer['source_sha256'] == files['tests/tools/score.py']
privacy = read_json(out / 'privacy-redirect-summary.json')
assert privacy['passed'] and privacy['offOriginRequests'] == 0
assert len(privacy['fixtures']) == 7
assert sum(len(f['observations']) for f in privacy['fixtures']) == 21
assert sum(bool(probe.get('exposed')) for f in privacy['fixtures'] for probe in f['observations']) == 6
assert files['tests/scored/functional/judge.toml'] == '8fd8bf84685f4ae7273e4245e236b7be80983071d34a16f379a4be871d511029'
assert files['tests/scored/functional/prompt.md'] == '9f4a764677e273e816df675d5b8d58be3a4b4219eed3a4df2720df2b5441b9ea'
images = read_json(out / 'final_image_evidence.json')
assert images['passed'] and images['source_unchanged_during_build']
assert images['source_before_build'] == {k: v for k, v in files.items() if k.startswith(('environment/', 'tests/'))}
assert all(files['tests/' + k] == v for k, v in images['verifier_source_hashes'].items())

binding = {
    'candidate_sha256': candidate['sha256'], 'previous_sha256': old['sha256'],
    'changed_files': changed, 'unchanged_files': len(files) - len(changed),
    'solution_files_hash_matched': 23, 'source_and_extraction_assertions': [90, 90],
    'final_image_source_matched': True, 'restart_cases_passed': 5,
    'harness_cases_passed': 4, 'full_golden_browser_restart_passed': True,
    'privacy_fixture_count': 7, 'privacy_probe_count': 21,
    'golden_flow_groups_passed': 6, 'synthetic_score_cases_passed': 20,
    'oracle_measured': False, 'target_model_measured': False,
    'reuse': 'All 23 golden/installer files match the independently executed b34 archive. Prior 45-criterion observations remain app evidence; the changed privacy and restart protocols have separate fresh regressions. Earlier rubric-hash bindings remain historical, not current.',
}
write_json('final_candidate_binding.json', binding)

findings = read_json(previous / 'qc_final_findings.json')
findings['candidate'] = candidate
findings['scope'] = ('Second independent requirements-first semantic review of all 45 criteria and 53/48 sheet entries, plus reproduced harness and redirect defects, repaired focused tests and new artifact checks. Prior unchanged evidence is explicitly reused. No private platform checkers, paid Oracle or target-model execution.')
findings['evidence_binding'] = binding
findings['resolved_in_second_review'] = [
    {'issue': 'Restart readiness accepted a surviving old process after the replacement crashed.', 'repair': 'Bounded old-group termination, remaining-listener rejection, new-PID liveness and bounded readiness.', 'evidence': 'HARNESS_REVIEW.md; restart_fixed_probe_results.json; harness_regression_results.json'},
    {'issue': 'Harmless HTTP redirects could fail the confidentiality criterion without exposed private content.', 'repair': 'Observed bounded local redirect handling, uninspected destinations disclosed, no off-origin follow; positive private-file signatures still fail.', 'evidence': 'PRIVACY_REDIRECT_REVIEW.md; privacy-redirect-results.json; privacy-redirect-summary.json'},
]
updates = {
    'verifier_entrypoint_is_safe_and_always_scores': 'Second review reproduced and repaired false restart success. Five actual MCP lifecycle cases, four orchestration cases and full golden browser restart pass on the exact shipped test.sh hash. New helper verifies old-group exit and replacement PID liveness; canonical scorer/MCP Python are unchanged. See HARNESS_REVIEW.md.',
    'verifier_and_instruction_agree_on_the_runtime_contract': 'Initial/restart app CWD, DB_PATH and sanitized launch contract are preserved. Actual restart now stops the old process group and rejects a failed replacement or residual listener. Real golden restart and subsequent save passed; five lifecycle controls pass. Public runtime requirements and canonical Python tools remain unchanged.',
    'no_criterion_grades_the_unrequired': 'The second reverse review found a hidden no-redirect assumption in confidentiality handling and corrected it. Same-origin fallback and off-origin redirects now have explicit bounded observations; no arbitrary status, MIME, response length, supersession notice or app-CDN prohibition is required. Seven installed-MCP fixtures distinguish benign alternatives from real exposed files.',
    'criteria_are_outcome_based_and_browser_decidable': 'The actual installed MCP proved manual fetch plus browser response metadata can observe redirects and bounded local chains. Seven fixtures cover safe fallback, direct/redirected leaks, off-origin, loops, hop limits and transport failure; zero off-origin requests. Source evidence remains forbidden except narrow private-file classification. See PRIVACY_REDIRECT_REVIEW.md.',
    'criterion_description_is_self_consistent': 'Confidentiality now consistently fails positive recognizable exposure, accepts completed bounded observations, and records uninspected redirect destinations without claiming exhaustive safety. Genuine transport/setup failure cannot establish a pass. Other conjunctive criteria and optional freedoms were reread in SEMANTIC_REVIEW.md.',
    'core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be': 'Fresh golden UI-created primary/copy/deleted records were checked across the actual repaired single-use MCP restart: old process exited, replacement stayed live, exact fields/revisions survived, deleted row remained absent and a subsequent new revision was saved/freshly read without changing the copy. See harness_golden_browser_restart.log.',
    'negative_checks_have_positive_controls': 'Existing behavioral refusal controls remain unchanged. Seven fresh privacy fixtures each include working HTTP/UI controls and recovery, distinguish six private-content detections from benign redirect alternatives, and retain real socket failure as incomplete evidence. Restart controls cover both normal success and false-success counterexamples.',
    'cross_file_runtime_contract_is_consistent': 'New source and extracted-source audits each pass 90 assertions. Candidate manifest, final_candidate_binding.json and rebuilt images bind all 50 shipped files; only test.sh and Functional judge/prompt differ from b34. All 23 solution files match the independently executed golden; 33 Functional criteria/49.5 and canonical policy are unchanged.',
    'dimension_prompts_are_accurate_and_consistent': 'All five task-specific prompts were reread. Functional prompt and its privacy criterion now agree on three initial paths, observed same-origin redirects, three-hop cap, no off-origin requests, limited file classification and incomplete transport evidence. No other dimension changed; independent ownership and gates remain consistent.',
}
for check in findings['tasks'][0]['checks']:
    if check['id'] in updates:
        check['evidence'] = updates[check['id']]
    check['evidence'] += ' Review binding: QC_FINAL.md / final_candidate_binding.json; unchanged prior detailed evidence is in ../full-qc-2026-09-27/.'
for check in findings['deterministic']:
    check['note'] += ' Rechecked against replacement archive d254c73e6ebe; source/extraction audits and actual-image hashes are in this directory. Canonical Python/scoring files remain unchanged; repaired generated restart shell is documented in HARNESS_REVIEW.md.'
write_json('qc_final_findings.json', findings)
quality_counts = dict(Counter(c['verdict'] for c in findings['tasks'][0]['checks']))
det_counts = dict(Counter(c['status'] for c in findings['deterministic']))
assert len(findings['tasks'][0]['checks']) == 53 and len(findings['deterministic']) == 48

text = f'''# Colderwater second cross-check — 27 September 2026

Two additional defects were reproduced and repaired. No unresolved concrete blocker was found in this local review. This is not platform acceptance or a measured Oracle result.

## Replacement candidate

- [Upload ZIP](colderwater-playground-devtools.zip): `{candidate['sha256']}`.
- {candidate['files']} files, {candidate['bytes']} bytes, one root; CRC, shell modes/LF and extraction hashes verified.
- Supersedes the immutable `b34abc10a29b…` archive in `../full-qc-2026-09-27/`.
- Exactly three changed files: `tests/test.sh`, `tests/scored/functional/judge.toml`, `tests/scored/functional/prompt.md`. All 23 golden/installer files are byte-identical.
- 33 Functional criteria / 49.5 total internal weight, two gates, four Polish and six Visual criteria. The 60/20/20 policy and strict Functional floor remain unchanged.

## Confirmed repairs

1. **False restart success.** The old helper accepted HTTP from a surviving SIGTERM-resistant server while its replacement crashed. The repaired helper proves old-group exit, rejects another listener, checks new-PID liveness and keeps waits inside the MCP deadline. Five lifecycle controls pass. A real golden browser restart proves durable records and a subsequent successful save. [Harness review](HARNESS_REVIEW.md).
2. **Redirect false failure.** The private-file check could reject a harmless redirect. It now follows only observed same-origin redirects within a three-hop bound, reports other destinations uninspected, and fails recognizable private contents. Seven actual-MCP fixtures / 21 probes passed, including six direct/redirected leak detections and zero off-origin requests. Transport failure remains incomplete evidence. [Privacy review](PRIVACY_REDIRECT_REVIEW.md).

## Evidence and review results

| Evidence | Result |
| --- | --- |
| 53 quality judgments | {quality_counts} |
| 48 deterministic procedures, local/manual equivalents | {det_counts} |
| Source / extracted source assertions | 90/90 each |
| Restart lifecycle controls | 5/5 |
| Orchestration controls | 4/4; synthetic judging only |
| Full golden browser/process restart | Passed |
| Independent golden browser flow | 6/6 groups; zero page errors |
| Actual-MCP privacy fixtures | 7/7; 21 path observations |
| Canonical scorer fixtures | 20/20; synthetic inputs |
| Rebuilt agent/verifier images | Exact seven public input / fifteen verifier file hashes match |
| Archive and current source | All 50 file hashes match |

The second semantic reviewer read the public requirements before all 45 criteria and five prompts, then both QC workbooks and prior evidence. See [semantic review](SEMANTIC_REVIEW.md), its superseding privacy finding, [golden recheck](GOLDEN_RECHECK.md), [findings](qc_final_findings.json), and [candidate binding](final_candidate_binding.json). The independent golden review checked all 45 prior detailed witnesses and performed a fresh continuous browser flow on the b34 archive. Their reuse here is justified by all 23 solution hashes matching; the changed restart/privacy protocols have fresh separate proofs. Previous report/hash files remain historical and were not relabelled as newly executed tests.

The frozen images are `colderwater-agent:20260927-crosscheck` and `colderwater-verifier:20260927-crosscheck`; [image evidence](final_image_evidence.json) records actual IDs, Chromium version and file hashes. The provided template and canonical `score.py`, `restart_mcp.py` and `scoring.toml` were not changed. The task's generated restart shell deliberately repairs a reproduced template defect while preserving its runtime contract.

## Limits and score implications

The seven quality Notes retain the prior explicit limits: complete paid-judge timing, provider execution, aesthetic judgments, bounded architecture/security coverage, arbitrary mocks, real-product ranking and remote-provider reproducibility. The official private static-checker scripts were unavailable; report coverage does not mean they were executed. Bounded private-file probes do not inspect redirect bodies, off-origin destinations or arbitrary filesystem routes. Diagnostic failed fixture attempts remain in this directory with their own labels.

There is no measured Oracle or target-model result for this ZIP. Local golden behavior supports the Oracle target but does not guarantee judge-assigned 1.0. The redirect fairness repair can restore at most `0.6 × 0.5 / 49.5 = 0.0060606` total reward when gates/floor already pass. Correct restart detection can remove previously unearned persistence credit; no model score is inferred from that bound. The prior provisional functioning-model estimate of 0.55–0.75 remains unmeasured, so a score at or below 0.7 is not guaranteed.

No paid calls, platform upload, commit or push were made in this cross-check. Shared lessons and the current handoff were updated. Use this replacement ZIP, not an older archive.
'''
(out / 'QC_FINAL.md').write_text(text, encoding='utf-8')
print(json.dumps({'candidate': candidate['sha256'], 'changed': changed, 'quality': quality_counts, 'deterministic': det_counts, 'all_bindings_passed': True}))
