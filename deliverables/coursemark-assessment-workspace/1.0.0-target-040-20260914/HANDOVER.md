Coursemark revision targeting a GPT score around 0.4

Upload `coursemark-assessment-workspace.zip` from this folder. The archive contains one task directory, 37 files, task version 1.0.0, and prompt revision r3. Reports, run outputs and local test fixtures are outside the task ZIP.

The target is approximately 0.4 for GPT; it is not a measured result for this revision. Oracle remains a 1.0 acceptance target, also requiring a new platform run.

The supplied previous runs scored:

| Model | Final score | Interpretation |
| --- | ---: | --- |
| GPT-5.4-mini | 0.7697 | Passed 26/31 Functional criteria; five Functional failures and two Polish failures. |
| Gemini-3.7-flash | 0.7160 | Some negative-test evidence was incomplete; a supplemental numeric-validation probe passed. |
| Oracle | 0.9583 | All Functional and Polish criteria passed. Visual score 0.7917 caused the shortfall. |
| Claude Haiku 4.5 | 0.0707 | Partial app following an agent error/exit 137; not a clean difficulty sample. |
| Nop | 0.0000 | No app; ungraded no-op. |

The complete prior review, including all model verdicts, is in [ANALYSIS.md](../1.0.0-scored-review-20260914/ANALYSIS.md). Those scores belong to the previous 55-criterion task, not this ZIP.

GPT's observed failures included enabled Publish on an empty draft, accepting a fresh start while an attempt was active, converting an empty rubric score to zero, failing the manual objective-only grading/release journey, and ignoring forged server-owned fields instead of rejecting them. It passed earlier concurrency and clock checks that a previous estimate had assumed it would miss. Reweighting those five failures alone is not a reliable path to the requested difficulty.

This revision adds three explicit product workflows, with complete golden implementations:

- Weighted outcome ledger: atomic whole-policy edits, published-only weights, latest-attempt calculations, real zero versus missing/unreleased work, excused denominators, final-only rounding, private student rows and instructor search.
- Atomic grading worksheet: multi-row validation and commit, partial selection, one revision/event, two-grader conflicts with retained inputs, deliberate retry and durable historical receipts.
- Reviewed batch release: server-bound selection and revision, readonly preview, stale-preview rejection even with fresh request metadata, atomic release, one event per attempt and durable replay/consumption rules.

The task instructions expose every new requirement in `/assets/instructions/outcomes.md`. The golden solution implements the routes, SQLite state and browser controls. It also closes private dialogs on account-wide sign-out, delays exposing the workspace until login data is ready, improves mobile navigation and text contrast, and removes the persistent mouse-focus outline while retaining keyboard focus visibility.

The rubric has 66 criteria: Render 2, Constraints 2, Functional 38, Polish 18 and Visual 6. All 55 existing criterion IDs and weights remain. Seven new Functional criteria have weight 12 each; four new Polish criteria have weight 2 each. Functional weight totals 132.75 and Polish weight totals 22. The new Functional workflows represent 63.3% of Functional credit because this revision makes them a substantial part of the product contract. They test separate workflow properties, with both successful and rejected operations. No model-specific exception or forced failure was added.

The 60/20/20 Functional/Polish/Visual formula, gates, agent budget, judge configuration and timeouts are unchanged. As a conditional arithmetic illustration, an implementation retaining GPT's old credited work, implementing none of the new workflows, and retaining its old Visual score would score about 0.429. This is not an evaluation or forecast: a new model run sees the expanded instructions and may implement the new workflows. Only reruns can establish the actual score distribution.

Local validation:

- 145 repository standard checks passed.
- 32 API/browser regression groups passed against the source and again against the extracted final ZIP: 17 original, 7 earlier hardening and 8 new workflow groups, including actual process restarts.
- Actual RewardKit schema discovery loaded all five dimensions; embedded runner Python and shell/JavaScript syntax checks passed.
- Ten reward-postprocessor cases passed, covering gates and malformed/missing scores.
- 34 rendered desktop/mobile surfaces were captured and reviewed with no horizontal overflow in the checked views. These are visual review artifacts, not judge scores.
- The original seed copies remain byte-identical. Archive contents, permission bits and prompt/config hashes were checked.

The local runner uses an explicitly synthetic score fixture solely to exercise postprocessing and CTRF. Its 0.58 is not an Oracle or model score. Local tests use the cached `coursemark-tests:1.0.17` image and execute the actual golden `solve.sh`. Fresh environment-image construction failed because the configured proxy hostname could not resolve; fresh verifier-image construction failed during PyPI download timeouts. No full image-build success or platform QC success is claimed.

Next run: upload this ZIP and run platform QC, then Oracle. Inspect every Oracle miss and correct the implementation or an evidenced grader defect before accepting the task; local checks cannot establish subjective Visual 1.0. Once Oracle reaches 1.0, run GPT-5.4-mini on the same exact ZIP, ideally with repeated runs, then compare the other model runs. Calibrate further from those observed results if GPT remains materially above 0.4. Preserve the same full-credit contract for every model.

ZIP SHA-256: `9a05ce3e64e5cdb809485c0c59d3ffd2d75f7d86baf156c61a23eb38a8a867e9`.

Evidence: `package-verification.json`, `standard-check.json`, `regressions.json`, `hardening.json`, `outcome-regressions.json`, `runner-logs/`, `visual-review/`, and the two `*-build-result.json` files. `source-before-expansion/` preserves the previous source; the previous delivered ZIP is unchanged.
