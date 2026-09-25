# Pellmoor batch-offer run review — 14 September 2026

Oracle reaches the requested 1.0, including Visual. GPT-5.4-mini receives a supported browser-gate zero, so the requested 0.1–0.7 calibration band is not established. Its batch implementation was not exercised by the judges. Gemini remains an unrestricted comparison and has several unresolved judge-evidence gaps.

| Submission | Reward | Functional | Polish | Visual | Render / Constraints |
|---|---:|---:|---:|---:|---|
| Oracle | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1 / 1 |
| GPT-5.4-mini | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 / 0 |
| Gemini 3.7 Flash | 0.7940 | 0.8316 | 0.6000 | 0.8750 | 1 / 1 |
| Claude Haiku 4.5 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 / 0 |
| No-op | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Ungraded control |

## Integrity and scoring

- Five trials across four run folders share platform task checksum `f362e3fa5d09fdda1804e5176e1e9aad84f3538f0636cc99ebbc676cdd37f52d`. All completed without a recorded trial exception.
- All five prompt hashes, five judge hashes, runner hash and reward-configuration hash match the frozen batch-offer ZIP, SHA256 `b4551a67636584eaea42346466aaf3f36c045ce245ede146f62dbcf8ed989a6c`. Platform task checksums and ZIP byte hashes are different identifiers; they should not be compared as equal.
- All 32 packaged file hashes match the packaging manifest. Seven deployed Oracle source/config files match the golden solution byte for byte. `solve.sh` is not present in the deployed app export and is not claimed as independently matched there.
- Each graded trial contains all 60 criteria: 2 Render, 2 Constraints, 40 Functional, 10 Polish, 6 Visual. All dimension scores recalculate from criterion values and weights. Functional has total weight 98.
- Every final reward agrees across `reward.json`, `reward.txt` and trial `result.json`, and satisfies the required zero gates followed by `0.6 * functional + 0.2 * polish + 0.2 * visual`.
- Gemini's intermediate `rewardkit.log` says 0.9313. That is not its final platform reward. The runner explicitly recomputes the required formula; `0.6 * 0.8316 + 0.2 * 0.6 + 0.2 * 0.875 = 0.79396`, rounded to 0.7940. This explains the discrepancy without changing any score.
- All recorded judges identify `codex` / `gpt-5.6-luna`. The matching packaged task and test image configure judge reasoning effort `max`. GPT and Gemini solver configurations separately record `high`; this is distinct from the judge configuration. The exports do not independently expose each judge's effective reasoning setting.
- All 161 uploaded files remain byte-identical before and after this audit. Task source and the frozen ZIP were not edited.
- A targeted scan of exported application source found no references to rewardkit, verifier result paths, `/tests/`, or instructions to manipulate scoring. This is limited evidence, not a claim that every possible interference mechanism was exhaustively ruled out.

## Oracle: requested result achieved in this run

Oracle receives full credit on all 60 criteria, including 40/40 Functional and all eight added batch criteria. The judge reports read-only preview, atomic commits and rejections, authorization, stale review, both race types, lost-response recovery, historical receipts, and persistence checks passing.

All six Visual axes receive 1.0: typography, color/contrast, spacing/layout, hierarchy, craft, and responsive consistency. The judge specifically reports clean identifier wrapping, desktop/phone adaptation, blocked review presentation, and consistent light/dark palettes. Polish is 10/10.

Compared with the historical review, Oracle improves from 0.9833 overall / 0.9167 Visual to 1.0 / 1.0. These are separate platform runs; the old run has not been rescored. The new export contains judge reasoning but no full replayable judge trajectory or screenshot collection, so visual quality is supported by this platform judgment and the prior local presentation evidence, rather than newly inspected platform screenshots.

## GPT: real rendering defect, workflow coverage blocked

The exact solver is **gpt-5.4-mini**, with solver reasoning effort `high`.

The judges report that the local sign-in page loads and survives reload, correct credentials obtain a bearer session and protected local hiring data, and wrong credentials are rejected. Rendering the authenticated workspace then throws `RangeError: Invalid time value`, leaving the sign-in shell visible. The unchanged explicit global browser gate consequently sets every dimension to zero.

The exported source corroborates the cause:

1. `backend/server.js:249` spreads SQLite activity rows directly, retaining `created_at`, `actor_email`, `vacancy_revision`, and other snake_case fields.
2. `backend/server.js:494` and `:508` put these activity rows directly into the vacancy response.
3. `src/app.ts:1019` calls `timeLabel(item.createdAt)`.
4. `src/app.ts:706` formats `new Date(iso)` without validating it. The absent `createdAt` becomes an invalid date and the formatter throws.

The audit executed those exact exported adapter/formatter functions with a synthetic SQL row. It reproduces `RangeError: Invalid time value`; supplying the existing `created_at` value succeeds. See `gpt-source-witness.json`. This is a narrow source-level reproduction, not a browser rerun, repair, or replacement score.

Therefore the zero is supported by a solver application defect, with no recorded timeout or launcher failure. However, the 40 zero Functional criteria are gate-propagated outcomes; they are not evidence of 40 independently tested business-rule failures. No conclusion about GPT's batch correctness, concurrency, receipt durability, or post-login visual quality follows from this run.

The earlier GPT reward was 0.7661. The new zero must not be presented as proof that the batch requirements selectively broke GPT. The observable failure occurs before the batch journey. It is below 0.7 but outside the intended 0.1–0.7 band. One run also does not establish repeatability.

## Gemini: substantial coverage, seven Functional deductions

Gemini passes 33/40 Functional criteria, earning 81.5/98 weighted points. All four basic batch preview/commit/rejection/race criteria pass. The remaining deductions are:

| Criterion | Lost weight | Interpretation of supplied evidence |
|---|---:|---|
| `competing_offers_cannot_overbook` | 3.0 | Race passed, but judge did not capture a fresh full-capacity loser rejection before withdrawing the winner. Missing checkpoint; overbooking defect not demonstrated. |
| `capacity_release_does_not_reexecute_old_receipts` | 2.5 | Winning success receipt replayed safely; saved full-capacity rejection was never established. Missing prerequisite. |
| `batch_authorization_and_selection_contract` | 2.0 | Judge reports a forged actor field was accepted and the batch committed as Ruth. Authorization/selection negatives otherwise passed. Exact request field and payload are absent from the export. |
| `batch_stale_confirmation_requires_review` | 2.0 | API stale rejection and fresh commit worked; original reviewed UI session crashed. Could be application or browser/session setup failure; source of the crash is not established. |
| `batch_lost_response_recovers_original_operation_and_live_view` | 2.0 | Interception setup failed after commit and withholding the response; exact receipt/retry evidence was not captured. Harness/evidence gap. |
| `batch_receipts_remain_historical_after_capacity_release` | 3.0 | Full-capacity rejection was captured, but replay-before-new-offer and C-withdrawn/D-offered checkpoints were lost. Incomplete sequence. |
| `success_and_rejection_receipts_survive_restart` | 2.0 | Several saved successes/rejections replayed correctly after restart; the lost-response receipt was never captured. Deduction partly cascades from missing earlier evidence. |

The actor-field finding requires precision: `backend/hiring.js:12–37` explicitly rejects the literal `actor` key and `author_email`, but omits aliases such as `actor_email` and `actorEmail`. The batch route invokes this check. This supports an incomplete forbidden-field check, but does not independently prove which field the judge sent. It also does not show impersonation: the judge says the operation remained attributed to authenticated Ruth. A retained request/response pair is needed to settle the exact failed probe.

Five clearly missing-evidence deductions account for 12.5/98 Functional weight. The stale-UI deduction adds another 2/98 with unresolved cause. Do not reinterpret these as demonstrated app failures, and do not award replacement credit without rerunning the checks. The supplied score remains 0.7940.

Positive evidence includes authentication/revocation, seeds, exact funnel history, role restrictions, stage transitions, panel versions, score bounds, malformed ordinary writes, individual concurrency/replay, actor-scoped receipts, batch atomicity/races, and the durable cross-role audit after restart. Full criterion reasoning is retained in `criterion-results.csv`.

Polish loses four criteria: selection indicated only by color, 513–515px document width at a 390px viewport, missing navigation/headings and non-semantic candidate cards, and keyboard/focus failures. Visual loses 0.25 on contrast and 0.5 on responsiveness; the other four axes are full credit. These are reported concrete presentation defects, separate from Functional setup gaps.

## Haiku: browser control failure

Haiku signs in and displays local protected records, but vacancy/candidate clicks raise `ReferenceError` for `selectVacancy` and `selectCandidate`. Anonymous and wrong-password checks reportedly refuse protected reads correctly.

Its bundled `public/app.js` is enclosed in an IIFE beginning at line 2. The HTML templates use inline `onclick="selectVacancy(...)"` and `onclick="selectCandidate(...)"`. `selectVacancy` exists only inside the private closure at line 657, without a window export; `selectCandidate` has no definition in the exported bundle. This supports the failed interactive-workspace gate. It differs from the previous Haiku run's launcher working-directory problem. Business-rule and visual zeros again propagate from the gate and do not establish individual workflow defects.

## Recommended next work

1. Preserve the current Oracle-qualified ZIP and these original scores. No additional hardening is justified by GPT's early crash alone.
2. Run fresh, unmodified GPT-5.4-mini attempts on the same frozen package to assess whether a working submission lands inside 0.1–0.7. Do not patch this solver output or weaken the browser gate to manufacture an in-band result.
3. Make the Functional judge retain explicit checkpoint evidence: request identity/body, response status/body, current revision/capacity, and before/after state. Verify a fresh full-capacity rejection before any release, retain that receipt, and replay it before a new offer changes capacity again.
4. Repair lost-response interception reliability: capture the actual response before aborting delivery; preserve the request and receipt outside the page; verify retry identity and live state separately. Recover later setup through lawful UI actions if an earlier probe fails, rather than allowing one capture failure to erase evidence for several criteria.
5. Distinguish a browser session/tool crash from a reproducible app exception. Retain the exact forged-actor payload. These improvements concern judge reliability and evidence; existing rules and weights should stay fixed unless a separately justified task revision is requested.
6. If verifier code or prompts change, freeze a new artifact and rerun Oracle and GPT. Oracle 1.0 here applies to this evaluated revision only.

The package is demonstrated Oracle-correct by this platform run. It is not yet demonstrated to meet the full GPT calibration target or to have no verifier evidence caveats.

## Audit artifacts

- `run-review.json`: scores, deductions, provenance matches, model settings, trial identifiers, and source witness.
- `criterion-results.csv`: 240 criterion rows across four graded submissions.
- `run-file-hashes.json`: SHA256 for all 161 uploaded files.
- `gpt-source-witness.json`: exact formatter failure and valid timestamp control.
- `audit-runs.py`: repeatable read-only verification and report-data extraction.
