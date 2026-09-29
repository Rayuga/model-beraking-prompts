"""Bind the incremental independent review to the replacement archive."""
import hashlib
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

root = Path.cwd()
out = Path(__file__).resolve().parent
previous = out.parent / 'eight-issue-fix-2026-09-27'
task = root / 'projects/colderwater-playground-devtools'
read = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
write = lambda name, value: (out / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
manifest = read(out / 'candidate_manifest.json')
current = {p.relative_to(task).as_posix(): sha(p) for p in task.rglob('*') if p.is_file()}
assert current == manifest['source_sha256']
old = read(previous / 'candidate_manifest.json')['source_sha256']
changed = [p for p in current if old.get(p) != current[p]]
assert set(changed) == {'tests/test.sh', 'tests/app_context.md', 'tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md'}
assert read(out / 'final_image_evidence.json')['passed']
assert read(out / 'source_audit.json')['passed'] == 90
assert read(out / 'extracted_source_audit.json')['passed'] == 90
assert read(out / 'regression_mutation_results.json')['passed']
assert read(out / 'harness/review_binding.json')['patched_shell_sha256'] == current['tests/test.sh']
assert read(out / 'harness/final_archive_review.json')['passed']
index = read(out / 'golden/GOLDEN_CRITERION_EVIDENCE.json')
assert len(index['all_current_criteria']) == 47
write('change_scope.json', {'baseline_sha256': read(previous / 'candidate_manifest.json')['sha256'],
    'candidate_sha256': manifest['sha256'], 'changed': {p: {'before':old[p], 'after':current[p]} for p in changed},
    'unchanged': [p for p in current if p not in changed],
    'golden_public_notes_weights_and_configuration_unchanged': True})

inventory = read(out / 'qc_inventory.json')
findings = read(previous / 'qc_final_findings.json')
findings['candidate'] = manifest
findings['scope'] = ('Independent final cross-check of all53 quality and48 documented deterministic definitions. '
    'Current source/extraction/images checked; prior evidence reused only for unchanged portions, with new actual-CLI '
    'and targeted browser proofs. No private platform checker, hosted Oracle, paid provider or target-model run was used.')
findings['evidence_reuse'] = {'baseline': previous.relative_to(root).as_posix(),
    'policy': 'Previous assertions are scoped to unchanged code and criteria; affected findings below supersede them.',
    'superseded': 'The previous missing-reasoning fixture was wrong: real RewardKit omits empty reasoning. Prior mocks alone did not prove serializer compatibility.'}
updates = {
4: 'Public notes and runtime contract unchanged. Six revised descriptions now accept hidden provisional previews and temporarily blocked further input. Completed Stop, successful title trimming, latest interaction rollback and separate examples are already explicit public requests; no new public feature was added.',
6: 'Independent public-first review found and repaired two valid-alternative risks: pending DOM may stay hidden and further pending input may be ignored/blocked. Real static-last-good overlay controls exercise both. Ordinary undocumented Escape remains accepted; proactive stale-write prevention is consistently allowed.',
11: 'Canonical budgets unchanged:600+600 within1500 gate wrapper;9000+900+900 within11100 scored wrapper;12600 below13200 verifier. Restart remains position22. New example/Stop/commit checks add real work; complete hosted judge duration is unmeasured. Local fast execution is not a timeout certification.',
17: 'All23 golden files are identical to a017. The current47-row criterion map binds new descriptions and targeted fresh evidence, with exact-hash reuse for unchanged implementation/observations. No source-only golden repair or unbuilt bundle change occurred.',
18: 'Fresh browser proofs cover padded create/rename, completed-preview Stop, latest committed rollback, allowed static overlays and example-copy separation. A separate five-group continuous sequence covers gate record, save/load, real process restart and dirty-editor conflict. These are local capability observations, not a measured full Oracle score.',
20: 'All50 current task files match the new manifest/ZIP/extraction. Only four verifier files changed from a017; golden and public inputs remain identical. No commit/push/upload or paid execution was performed in this cross-check.',
21: 'Actual installed RewardKit0.1.7 CLI exposed an omitted-empty-reasoning false rejection. test.sh now defaults absent reasoning to empty text; null/nonstring, evaluator errors and incomplete markers remain invalid. Fresh10 actual-CLI outcomes,43 guard fixtures,4 orchestration cases and39 harness bindings passed. CLI transport fixture was local, not a semantic provider judge.',
22: 'Rebuilt verifier/agent images match current shipped files and retain pinned CLI/MCP/Chromium. Actual installed CLI serialization and MCP restart/browser behavior are exercised locally. Provider authentication, full paid grading and hosted scheduling remain unmeasured.',
26: 'Independent review mapped all35 Functional criteria against public notes and all five prompts/context. It added previously missing successful title normalization, latest-interaction rollback, completed Stop and immutable-example observations without adding rows/weight. Finite browser probes do not establish an exact database engine or exhaustive security properties.',
27: 'Pending candidate DOM is explicitly optional. Further pending input may dispatch or be blocked without extending its original budget. Fresh cancellation wording and shared context agree. Example-copy setup accepts any supplied language. No forced hidden/disabled control or app-specific package/layout is required.',
28: 'All35 Functional IDs/types/order/weights are preserved, total49.5. Original-run, completed-interaction and pending-interaction states remain separate contributions. Added controls establish the same public behavior, with no duplicate dimension weight or new hidden UI label.',
30: 'The pending-interaction test first commits a successful DOM change, then tests rollback to that latest state. Successful padded create/rename prevent collision-only normalization from receiving full credit. Completed Stop has proven-live handlers and subsequent recovery; examples use exact original/copy reload observations.',
31: 'Existing bounded negative cases are retained. New counterexamples close four concrete coverage gaps. Reserved-URL privacy is still a finite denial/fallback test, not proof against all disclosure routes or misleading error bodies. Security and timing precision limits remain disclosed.',
32: 'Fresh product flows use pinned direct Playwright and the real restart uses canonical MCP, with golden-hash binding. Static overlay alternatives prove no requirement to display provisional DOM or dispatch blocked input. Privacy/network recipes are unchanged and their previous actual-MCP evidence is retained by section hash. Tool/setup failures remain ungraded.',
33: 'All three revised semantic files were reread together. Optional pending display/input, latest committed state, completed Stop and proactive stale-Save prevention agree. Negative auto-run windows still use measured delay plus margin. Source-parsing exceptions were not reintroduced.',
34: 'Fresh browser observations supplement previous keyboard/error/network evidence. The failed first example probe was retained: CodeMirror innerText distorted blank lines; corrected DOM-line extraction verified exact user source. This was a test-driver error before Save, not an app failure.',
35: 'Fresh continuous database proof preserved gate/basic-save records through one actual canonical MCP process restart, then exercised a real dirty-second-editor conflict and deliberate recovery. Current harness launched and restarted from the correct CWD; durable state remained intact.',
37: 'The example-copy criterion creates one distinct user record and preserves its built-in example and unrelated records. All35 criteria retain ordered independent titles; the earlier restart preserves ongoing data. Polish/Visual state permissions remain unchanged.',
38: 'Observed product failures stay criterion-local. Actual CLI fixtures distinguish ordinary failures from absent/malformed/evaluator-error results; schema-valid omitted empty reasoning no longer invalidates a valid evaluation. Global gate and incomplete-marker semantics remain consistent.',
41: 'Binary and five-anchor visual domains unchanged. Actual RewardKit0.1.7 CLI serialization is now tested, including empty/omitted default reasoning, ordinary failures and valid raw-score equivalents. Explicit invalid domains and malformed reports remain rejected.',
43: 'Canonical score.py/scoring.toml bytes unchanged: two zero-weight gates,60/20/20 shares and strict Functional>0.05. Fresh gate failure/orchestration fixtures prove a failed prerequisite does not enter scoring. The new report-compatibility fix preserves legitimate zero/partial results.',
44: 'No dimension or criterion weight changed in this cross-check:35 Functional outcomes total49.5. Fairer pending-display/input wording can restore deserved credit; added stated-behavior coverage can remove undeserved credit. No target-model score movement or range is claimed without runs.',
48: 'Functional judge, prompt and injected context were frozen and independently reread. All other dimension prompts remain byte-identical. Actual UI conflict prevention and optional pending render/input rules no longer conflict. Short metadata still contains no QC history.',
49: 'Exact50-file source, ZIP, extraction and applicable image subsets agree. Canonical helpers/policy and all23 golden files are unchanged. Every current criterion hash is bound in the47-row evidence map; historical reports are explicitly scoped rather than silently relabelled fresh.',
51: 'Source90/90 and extraction90/90 passed, actual images built and shipped hashes match. Packaging checks CRC/root/modes,29 known guards and24 mutation fixtures. ActualCLI10/10, guard43/43, orchestration4/4 and targeted pinned-browser proofs passed. Full paid judge execution remains outside scope.'
}
by_number = {item['number']:item['id'] for item in inventory['quality']}
for number, identifier in by_number.items():
    row = next(c for c in findings['tasks'][0]['checks'] if c['id'] == identifier)
    if number in updates:
        row['evidence'] = updates[number]
    else:
        row['evidence'] = 'Retained after current source/hash cross-check; detailed prior evidence is under eight-issue-fix-2026-09-27. ' + row['evidence']
    row['finding'] = ''

for row in findings['deterministic']:
    row['note'] = 'Current source/extraction/image audit plus documented manual equivalent; private platform checker was unavailable. Prior unchanged evidence retained explicitly.'
    if row['name'] == 'check-scoring-policy.py':
        row['output'] = 'Canonical scorer/policy unchanged: gate0,60/20/20,floor.05. ActualCLI10,guard43 and orchestration4 outcomes passed; omitted empty reasoning remains valid.'
    elif row['name'] == 'check-verifier-contract.py':
        row['output'] = 'Current LF/bash syntax, bounded EXIT, unprivileged app, correct CWD/gate order and single-use restart checked. One-line reasoning compatibility fix tested through installed CLI; current images match frozen files.'

write('qc_final_findings.json', findings)
subprocess.run([sys.executable, '-B', '-X', 'utf8', 'harbor-webdev-rubric-qc/scripts/build_report.py', str(out / 'qc_final_findings.json'), '-o', str(out / 'QC_FINAL.xlsx'), '--client-safe'], check=True)

summary = f'''# Colderwater final cross-check — 27 September 2026

Use this replacement [ZIP](colderwater-playground-devtools.zip), SHA-256 `{manifest['sha256']}`. It supersedes a017; the old archive remains immutable. The replacement contains {manifest['files']} files and {manifest['bytes']:,} bytes. No platform attempt or paid judge/model call was used.

The independent pass found another real harness compatibility bug and several concrete fairness/coverage gaps. Those are fixed. The report does not certify zero future QC findings or Oracle1.0.

## What changed

- Installed RewardKit omits empty reasoning. The report validator now accepts that schema-valid output while still rejecting evaluator errors, incomplete markers and explicit nonstring reasoning.
- Pending preview changes can stay hidden; further input can be temporarily blocked. The verifier measures the original deadline and retained/restored state without forcing a golden-specific display/input policy.
- Existing checks now prove successful trimmed titles, rollback to the latest successful interaction, Stop after completed execution, and separate saved copies of built-in examples.
- Only four verifier files changed. Golden23 files, public notes, IDs, weights, provider, canonical helpers and timeouts are unchanged;35 Functional criteria still total49.5.

See [exact scope](change_scope.json), [semantics before/after](semantics/independent-semantics-review.md), and [actual CLI/harness review](harness/HARNESS_REVIEW.md).

## Evidence

- Source90/90 and extracted90/90 local assertions; actual rebuilt images match seven public and15 verifier files.
- 29 narrow regression guards and24 mutation fixtures, including22 known bad contracts rejected.
- 10 installed-CLI outcomes,43 report-guard fixtures,4 orchestration cases and39 harness bindings.
- Fresh golden browser flows for the changed outcomes and two valid static-overlay alternatives; five-group continuous save/restart/conflict proof. [Current47-criterion evidence map](golden/GOLDEN_CRITERION_EVIDENCE.json) distinguishes fresh and hash-bound reused evidence.
- [All53/48 dispositions](QC_FINAL.xlsx), [machine findings](qc_final_findings.json), [manifest](candidate_manifest.json), [image binding](final_image_evidence.json), and [final release assertions](release_validation.json).

## Remaining limits

Full hosted Oracle/model scoring and end-to-end judge duration are unmeasured. Local transport fixtures test RewardKit plumbing, not the semantic provider judge. The private platform checker implementation was unavailable; deterministic checks are local/manual equivalents. Timing witnesses retain normal scheduling assumptions, and reserved-URL checks are finite denial/fallback observations, not exhaustive security proofs. No concrete unaddressed material blocker was established in the bounded review.

The previous missing-reasoning negative fixture was wrong and is superseded by real CLI evidence. Earlier claims of complete compatibility based only on those mocks should not be reused. A browser probe's initial example-source extraction error was corrected and retained in evidence; it did not require an app repair.

Use the exact ZIP linked above if submitting. Keep the second remaining platform attempt for any actual platform-specific feedback; this review consumed neither.
'''
(out / 'QC_FINAL.md').write_text(summary, encoding='utf-8')
base = out.relative_to(root).as_posix()
handoff = f'''# Colderwater handoff — 27 September 2026

Current source: projects/colderwater-playground-devtools. Latest request: cross-check again because only two platform attempts remain. This local review consumed no platform attempt or paid/provider call. Ridgeline was not changed by this pass.

## Current release

- [Use this ZIP]({base}/colderwater-playground-devtools.zip), SHA-256 `{manifest['sha256']}`; {manifest['files']} files, {manifest['bytes']:,} bytes.
- Supersedes a0179323 from eight-issue-fix-2026-09-27. Keep that archive immutable; do not recommend it for upload.
- [QC summary]({base}/QC_FINAL.md), [client-safe workbook]({base}/QC_FINAL.xlsx), [manifest]({base}/candidate_manifest.json), [release binding]({base}/release_validation.json).
- 35 Functional binary criteria, total49.5; two zero-weight gates; four Polish checks; six Visual raw1–5 scales.47 task criteria, distinct from53 quality judgments.
- Canonical60/20/20 and Functional>0.05; agent7200/verifier13200; gate wrapper1500/scored11100; Functional9000,Polish900,Visual900. Judge env unchanged: claude-code fallback with z-ai/glm-5.3-flashx. Target builder gpt-5.6-luna is authoring context, not an override in task.toml.

## Latest fixes and evidence

Only test.sh, app_context.md and Functional judge.toml/prompt.md changed. All23 golden files, public notes, helper/scoring files, metadata, IDs and weights are unchanged from a017. See [exact delta]({base}/change_scope.json).

Real installed RewardKit0.1.7 serialization omits empty reasoning. The prior report validator wrongly rejected this schema-valid case; it now defaults omission to empty text while rejecting null/nonstring, evaluator errors and incomplete markers. The old mock expectation was wrong and is superseded. Actual CLI10/10, report guards43/43, orchestration4/4 and harness binding39/39 passed. Independent exact-archive audit36/36 passed. The local transport fixture did not invoke a real semantic provider judge.

The verifier now accepts hidden provisional previews and temporarily blocked further pending input. Existing checks additionally prove successful trimming on create/rename, rollback to the latest successful interaction, Stop after completed execution, and an edited example saved independently of its original. Any supplied example language is accepted. Proactive stale-Save prevention is consistently allowed with exact draft retention and independently observed server refusal.

Six changed browser groups passed as a composite, including two temporary static-overlay witnesses. A five-group continuous database sequence preserved six records across one actual canonical MCP restart, then passed dirty-second-editor conflict/recovery. Browser product actions used pinned direct Playwright; restart used canonical MCP. Previous unchanged actual-MCP security/keyboard evidence is explicitly reused. Two probe setup errors were retained and corrected without app changes: CodeMirror innerText blank-line extraction and reused local restart .used marker.

Source90/90 and extracted90/90 assertions passed. Rebuilt actual images match seven public and15 verifier files. Packager enforces29 narrow known guards;24 mutation cases include22 rejected bad contracts. [All47 current criterion evidence]({base}/golden/GOLDEN_CRITERION_EVIDENCE.json) binds current text and fresh/reused observations. Full53/48 review is documented with honest Note/N-A dispositions; private platform checker scripts were not executed.

## Limits and next action

Full hosted Oracle score, model score and complete judge duration remain unmeasured. No claim of Oracle1.0, guaranteed QC acceptance or a0.1–0.7 model score is justified yet. Timing has ordinary scheduling assumptions; privacy tests cover only declared URL denial/fallback behavior. No remaining concrete material blocker was established in the bounded review.

Use this exact ZIP if submitting. Do not silently consume paid runs: the earlier paid-run question remains unanswered. Current user preview colderwater-golden-preview-20260927 at localhost:3420 and its database were preserved. Leave it and unrelated containers alone. No commit/push/upload was performed.

Before future changes, read [prevention rules](QC_REGRESSION_PREVENTION.md), [context](NEW_TASK_AUTHORING_CONTEXT.md), [workflow](TASK_AUTHORING_WORKFLOW.md), and [QC skill](harbor-webdev-rubric-qc/SKILL.md). A source change invalidates affected archive/image/evidence bindings. A passing golden does not prove fair treatment of other valid implementations.
'''
(root / 'COLDERWATER_HANDOFF_2026-09-27.md').write_text(handoff, encoding='utf-8')
print(json.dumps({'candidate':manifest['sha256'], 'quality':dict(Counter(c['verdict'] for c in findings['tasks'][0]['checks'])), 'deterministic':dict(Counter(c['status'] for c in findings['deterministic'])), 'changed':changed}))
