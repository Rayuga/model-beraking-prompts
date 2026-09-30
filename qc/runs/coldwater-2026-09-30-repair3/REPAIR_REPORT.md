# Colderwater repair result — 30 September 2026

The task-owned findings have been repaired without removing product requirements or weakening the retained difficult scenarios. The final frozen golden passes **64/64 scripted Functional observations, 2/2 gates, 7/7 Polish observations and 11/11 additional runtime regressions**. This is local browser evidence, not a configured judge score or an Oracle result.

Candidate input: `27f81c18259555d26b61a5a2b0f026f0360b7380bc072523513b0ad2deca9efc`. See [manifest](manifest.json), [raw golden result](golden/run-golden-20260930-092021/RESULTS.json), [surface observations](golden/run-golden-20260930-092021/surface-results.json), [source guards](regression-guards.json) and [preflight](preflight.json).

## What changed

| Previous finding | Repair | Current evidence and limit |
|---|---|---|
| Undisclosed symlink restriction; rows 4, 23, 49 | Public integration note now describes the exact node_modules-only exception and rejects broken links. | Matches unchanged canonical test.sh; independently confirmed. The separate inherited restart concern in row 49 remains. |
| Golden loses primitive rejection lines; row 17 | Preserve source locations for primitive reasons, Promise forwarding/adoption and caught/rethrown values; preserve comma-expression throw semantics. Rebuilt the shipped frontend. | JS line 2 and full-HTML line 6 pass in the browser; 11 further compatibility cases pass. Independent extracted-helper confirmation covers nine reported witnesses. |
| Missing creation validation; row 26 | S24 now exercises invalid NEW creation as well as current-revision updates, with actual valid-write controls and complete unchanged-state reads. | Empty, whitespace, exact/padded collisions and case-sensitive valid titles pass. |
| Missing async HTML/terminal-duration coverage; row 26 | Added complete-HTML timer/rejection fixtures and reuses error, Stop and timeout observations for elapsed-duration evidence. | Both HTML asynchronous error families and all named terminal-duration branches pass. |
| Server evaluation promise has no distinguishing evidence; row 26 | S21 adds a controlled monitor/carrier canary across create, update and load, using the observed local backend request and a five-second settling window. | Monitor stays unchanged; the matching valid write succeeds afterward. This detects observable execution side effects and is not universal proof that source can never be evaluated server-side. The public security promise remains unchanged. |
| Rollback and later execution bundled; row 28 | Separate four recovery outcomes from four rollback outcomes using the same browser work and redistributed existing weights. | All eight independent outcomes pass. No scenario repeats merely because it has multiple outcomes. |
| Missing successful loop control; row 30 | Added finite braced, unbraced and Promise-callback loops before infinite-loop probes. Establish a fresh last-good document after those successful controls. | Finite outputs 3, 4 and 3; all three infinite loops terminate with reason, rollback and recovery. |
| Host title assumed static; rows 27, 31 | Isolation rejects the snippet's forbidden title and storage writes while allowing legitimate app-owned status titles. | Four blocked operations pass, including a browser variant whose host title changes with status. |
| Numeric duration label can be fabricated; row 32 | Compare a short successful run with the already-required four-second successful timer; inspect actual terminal durations separately. | Delayed and short values reflect observed elapsed time, with broad rounding/overhead tolerance. |
| Unsafe inherited restart/cleanup; rows 21, 49 | Shared harness intentionally unchanged. Reproduced the restart problem and prepared an owner report. | [Isolated counterexample](inherited-restart-counterexample.json) confirms false restart success. See [template-owner issue](TEMPLATE_OWNER_ISSUE.md). Canonical correction is still required. |

## Difficulty and shared policy

- Functional increases from 58 to 64 independent outcomes; total weight stays **32.70**, across the same **23 shared protocols**.
- No public feature was removed. Superseding and stopping pending work still reject late logs, errors and DOM changes. Failed work must restore the latest successful preview. Timer/Promise execution shares one budget. Both editor roles still undergo stale-Save refusal and exact dirty-draft recovery.
- The extra recovery rows distribute existing weight; they do not add easy reward mass. The finite-loop and elapsed-duration controls make false positives harder.
- `task.toml`, both Dockerfiles, `tests/test.sh`, `tests/scoring.toml`, scorer, restart MCP and all configured judge settings remain unchanged. Functional timeout remains 9000; reward remains 60%/20%/20%, with the template gates and floor.
- Luna 0.40–0.50 and Oracle 1.0 remain calibration targets. Neither is a measured score for this candidate.

## Verification performed

The final offline container run used the frozen task and pinned local Playwright/Chromium image. It completed in **118.827 seconds**, including the surface and additional compatibility checks. The actual canonical restart changed PID **16 → 338**, with the old process observed exited and saved records surviving. Logs bind the task, protocols, driver files and shipped application hashes. This elapsed time is scripted-browser time and cannot establish LLM judge workload.

All **53 local source regression guards** and **50 structural preflight assertions** pass. These are repository checks, not 53 semantic QC verdicts or the portal's private checker executables.

Three independent focused confirmations applied the workbook and Harbor QC skill to the corrections:

- [Runtime confirmation](targeted-runtime-confirmation.json)
- [Boundary confirmation](targeted-boundary-confirmation.json)
- [Coverage and difficulty confirmation](targeted-coverage-confirmation.json)

They confirm the targeted repairs, not a new full 53-row audit. Earlier reports, failures, driver-setup mistakes and intermediate candidates remain preserved. In repair1, the storage-canary driver accidentally replayed an old revision and a usability predicate mishandled uppercase headings; both driver defects were corrected rather than weakening task criteria. Independent review found additional Promise-location defects before repair3, and their paired evidence remains in repair1/repair2.

Desktop dark/light and mobile captures are retained. A fresh surface capture after allowing paint to settle also confirms the preview DOM survives theme/viewport changes. Visual judgment remains qualitative; no configured six-row Visual score is claimed.

## Remaining release work

**Not cleared for upload.** The canonical reconciliation is INCOMPLETE because the final bytes have targeted confirmations, not new full reviewer reports. The previous dedicated 53-point audit remains historical and cannot clear changed bytes. Preserve the user's one-agent-per-point preference when performing the next complete quality audit.

The inherited restart defect needs a canonical template-owner resolution. Full configured judge workload/launch, measured partial-app discrimination/ranking, and actual Oracle/target-model scores remain unmeasured. The bounded server-evaluation canary does not claim universal security assurance. Do not replace these gaps with generated pass tables or promise a portal result.

No paid provider run, portal upload, external message, commit or push was performed in this repair.
