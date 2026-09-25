# Pellmoor r7 failure review and r8 repair

These are genuinely new r7 runs. The earlier repair did not deliver the intended result: Oracle scored **0.8386** and GPT-5.4-mini scored **0**. The Oracle evidence collection and golden layout needed more work. GPT also encountered a missing browser dependency during development, then shipped an undetected fatal UI error.

The r8 package fixes those observed authoring and environment gaps. It does not establish a fresh platform Oracle score or promise a particular GPT reward.

## Uploaded results

| Model/control | Overall | Functional | Polish | Visual | Render / Constraints |
| --- | ---: | ---: | ---: | ---: | --- |
| Oracle | 0.8386 | 0.7449 | 1 | 0.9583 | 1 / 1 |
| GPT-5.4-mini | 0 | 0 | 0 | 0 | 0 / 0 |
| Gemini 3.7 Flash | 0.8545 | 0.8520 | 0.8 | 0.9167 | 1 / 1 |
| Claude Haiku 4.5 | 0.2153 | 0.0561 | 0.2 | 0.7083 | 1 / 1 |
| No-op | 0 | Not graded | Not graded | Not graded | Not graded |

All five trials have task checksum `23c88a5ab83d1877cad1fd16d23bc9f0d7c5773fc801e16663a599eaa3fe21b2` and Functional prompt r7, SHA256 `8915aec8a06c86f00c86f24c10e93b3875c217273d6429753ea4452b5b20a3f3`. Their recorded runner/helper hashes match the prior evidence-reliability package. No trial reports a platform exception. The final `reward.json`/`reward.txt` values above take precedence over rewardkit's intermediate aggregate.

All 202 uploaded files are preserved. [r7-run-review.json](r7-run-review.json) contains the scores, provenance, individual verdicts and GPT trajectory excerpts; [criterion-results.csv](criterion-results.csv) contains all 240 scored criteria across the four graded trials.

## Why Oracle lost credit

Oracle `pellmoor-job-pipeline__sfvtUWB` lost six Functional checks, totaling 25 of 98 weight units:

| Failed criterion | Weight | Uploaded explanation |
| --- | ---: | --- |
| Stale revision and reviewed retry | 8 | Initial stale-409 checkpoint was not reliably captured after setup failure. |
| Successful receipt replay | 8 | Original note request and replay were not reliably retained after setup failure. |
| Reopened assessment and frozen stages | 2 | Reopening worked, but the full frozen-write probe set was not captured. |
| Batch invalid-member/capacity rejection | 3 | Atomic rejections were observed, but B was not established with only Wren's current score missing. |
| Stale batch confirmation and review | 2 | First reviewed session was reportedly lost or crashed. |
| Lost-response batch retry/live view | 2 | Commit and uncertain UI were captured, but the first page reportedly crashed after the other session's withdrawal. |

The uploaded export contains the six persistence receipt files, so r7 did improve that part of collection. It still lacked durable early checkpoints and reliable handling of the primary page. The supplied files have no judge trajectory or browser crash stack that establishes the page-loss cause. Do not call it an out-of-memory failure or a golden backend defect without further evidence.

The Visual deduction was a real golden layout defect. Baseline measurements reproduced six clipped action areas: the desktop dialog ended at y=784 while the Review button extended to y=805; the phone dialog ended at y=836 while the button extended to y=849. The negative sticky-footer offset caused the lower controls to exceed the visible area.

## Why GPT scored zero

GPT `pellmoor-job-pipeline__fPdsGjc`, solver effort `high`, shipped a call to `renderActivityList(vacancy.activity)` in `src/app.ts:372` without defining that function. The served bundle contains the same unresolved reference. All five judges observed `ReferenceError: renderActivityList is not defined` after successful login; the populated workspace never rendered and remained on its loading screen. The documented shared browser gate therefore correctly forced every dimension to zero.

Its development trajectory explains why the error escaped the required browser check:

1. Step 51 installed Playwright; step 52 downloaded Chromium.
2. Step 53 attempted a real sign-in/navigation/reload browser check. Chromium failed before opening the page because `libglib-2.0.so.0` was missing.
3. The model then rebuilt and checked assets/login/bootstrap with curl. Those requests succeeded but did not execute the browser UI.
4. Step 59 handed over with an explicit request for browser-system dependency installation, leaving browser validation incomplete.

The task required browser validation but its agent environment did not provide a complete browser runtime. r8 provisions it for every solver and documents the existing global import and executable paths. This removes the observed setup obstacle; it cannot guarantee that the next solver will fix every application bug or finish in the requested reward interval. The uploaded GPT artifact and its zero score remain unchanged.

## r8 changes

- **Working browser tooling in the agent image.** The environment Dockerfile installs the same pinned Playwright MCP runtime as the verifier, Chromium and its Linux dependencies. `/instructions/browser-check.md` supplies a small runtime example and directs the solver to extend it with its own real login, candidate and reload checks. The product requirements are unchanged.
- **Preserve the primary session across secondary actions.** A verifier-owned `preserve-primary.js` helper runs preparation, one independent temporary-session mutation, and return to the original page within one MCP call. It closes its temporary context, records lifecycle events and context counts, and detects accidental primary navigation while the secondary acts. Ordinary navigation during preparation or final UI recovery is allowed.
- **Keep captured evidence even when a later wait fails.** `preparePrimary` receives `savePrepared`; callers store the actual committed response before waiting for an uncertain/retry UI. A subsequent callback failure retains that observation and prevents later actions. The helper itself supplies no app selectors, endpoints, authentication, mutations or scoring decisions.
- **Retain the three high-weight legacy checkpoints.** Immutable ledger labels now cover the original stale conflict, successful note and rejected-stage receipt in addition to the existing six persistence receipts. Legacy and persistence completeness checks remain independent. Missing evidence in one group cannot erase another group's demonstrated behavior.
- **Make the existing setups explicit.** The Functional procedure records B's exact current panel/scores before invalid-member checks and a separate snapshot for each frozen-stage probe. Impossible member-add/remove premises accept legitimate duplicate/absent-member refusal without imposing an unstated validation order. Otherwise-valid probes remain required. A stale rejection's baseline is captured after the legitimate secondary mutation and immediately before the rejected request.
- **Correct metadata probes.** Removing a JSON field while retaining a supported valid header does not test missing metadata. The verifier now removes every supported source of that field, keeps unrelated metadata valid, and tests the observed representation. This corrects a misleading Gemini deduction as well as protecting compliant implementations generally.
- **Keep golden dialog controls visible.** The batch dialog has a bounded scrolling body and a header/footer that stay within its viewport. Its actual planning, selection, review and commit behavior is unchanged.
- **Resolve the inherited upload-check wording failure.** Every prompt explicitly says to evaluate criteria independently and continue after individual failures. The shared gate and criterion semantics are unchanged. Prompt revisions and helper provenance are updated.
- **Align Render/Constraints aggregation with the canonical reference.** The final upload check exposed their inherited `all_pass` setting. Both now use `weighted_mean`, as the Bazaarbridge and Docketlight references require. The explicit shared browser gate still assigns zero to every criterion when it fails. This changes a mixed pair of binary outcomes from 0 to 0.5; it does not change any uploaded run here because those pairs are all-zero or all-one. It is a documented configuration correction, not an unchanged-scoring claim.

The task version remains `1.0.0`. All 60 criterion identities/types/weights, Functional/Polish/Visual aggregations, judge operational configuration, timeouts, golden backend, seed, hiring rules and final reward postprocessor remain unchanged. Render/Constraints aggregation changes are disclosed above. The changed public material concerns the available browser runtime and how to perform the already-required completion check. There is no model-specific scoring or exemption.

## Other model observations

Gemini's five recorded Functional deductions concern malformed metadata, pending feedback, hired-to-offer conversion, person-scoped receipt identities and missing pending/duplicate evidence during loss capture. Its metadata deduction explicitly describes a valid alternative header, so the rejection premise was not established. Its lost-response verdict says exact retry/live state worked but helper setup evidence was incomplete. These are reasons to improve measurement, not to overwrite its recorded 0.8545.

Haiku has extensive product failures: incorrect stage/backstep/terminal handling, missing operation identity and duplicate notes, incomplete panel setup, missing activity and batch controls, and capacity conversion problems. Its nonzero score is not evidence that those core workflows pass.

Further difficulty changes are not justified by these runs. GPT did not reach the application stage where the intended functional challenge could be measured. First validate r8 on Oracle, then run GPT on that same archive with solver effort `high`. Keep every attempt and inspect provenance; the historical 0.6327 belongs to r6 and cannot be transferred to this revision.

## Validation and limits

Local validation artifacts are collected beside the package:

- `batch-regressions.json`, `golden-evidence-workflows.cjs`, `runner-logs/`: 13 golden workflow groups, including legacy receipts, frozen writes, batch setup, competing writes, preserved-page stale/loss recovery, and actual restart. The local wrapper uses synthetic dimension values only to test the unchanged reward postprocessor; its **0.58 is not an Oracle score**.
- `mcp-preserve-primary-results.json`: six cases through actual pinned MCP, including a captured success followed by a preparation failure, a secondary-session failure, accidental navigation, and permitted preparation navigation. These use synthetic transport fixtures and do not rescore a model.
- `functional-support-checks.json`: 12 capture-validation/immutability/scope and criterion-contract checks.
- `visual-validation/`: baseline and fixed measurements/screenshots across desktop, phone and a narrower viewport, in both themes. The fixed version has zero clipped actions in all 18 reviewed views, no horizontal overflow/page errors, and working focus restoration.
- `standard-qc.json`, `upload-qc.json`, `package-verification.json`: checks against the actual frozen archive and extracted bytes; exact ZIP hash and changed-file list.
- `validation-attempt-1/`, `validation-attempt-2/`: earlier successful local runs, preserved before the capture-retention fix and final aggregation alignment. `package-attempt-1/` preserves the archive that exposed the aggregation mismatch; it is superseded by the root ZIP.

Product and helper checks use cached `pellmoor-tests:2.0.3` with the matching runtime. They do not establish that a newly built environment or verifier image completed successfully. The exact verifier build was attempted outside the sandbox and failed during PyPI downloads after 107.57 seconds. The environment build attempt was blocked by Docker sandbox access; the escalation request was cancelled before an exact build ran. Its provisioning is implemented but a clean environment-image build remains unverified. Build status/log files retain these limitations.

Harbor reported **Not authenticated** during this review. A new hosted Oracle/GPT evaluation could not be launched from this session. No fresh platform score is claimed; r8 remains a repair candidate until Oracle passes every Functional criterion and reaches the requested Visual/overall target on this exact package.
