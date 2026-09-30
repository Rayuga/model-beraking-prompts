# Colderwater dedicated QC: completed, release blocked

All 53 quality points were reviewed by 53 separate agent contexts using the frozen WebDev Rubrics QC workbook and Harbor QC skill. Workers ran concurrently, up to the available limit of three. Each reviewed one complete quality point; rows were not divided among three general reviewers. This followed the latest user instruction for this additional audit. The earlier three complete reviews remain separate historical evidence.

Final quality verdicts: **36 Pass, 11 Fail, 5 Not exercised, 1 Note**. These are failed QC rows, not 11 distinct implementation defects. The 48 deterministic rows were separately applied locally: **34 Pass, 10 profile Notes, 4 N-A**. Private portal checker executables were unavailable. Local preflight assertions, regression guards, parsers and manual profile checks are identified in their respective evidence files.

[Reconciled 53-row table](QC_53_RECONCILED.md) | [Completed workbook](QC_53_REVIEW.xlsx) | [Machine-readable result](reconciled-summary.json) | [Original independent reports](QC_53_POINTS.md)

## Confirmed source findings and bounded fixes

| Finding | QC rows | Evidence and impact | Next correction |
|---|---|---|---|
| Undisclosed symlink restriction | 4, 23, 49 | The canonical test.sh rejects every symlink outside its narrow node_modules exception, including a safe link entirely inside /app. The public delivery contract does not say this. A self-contained conforming app can receive zero before launch. Two dedicated reviewers independently confirmed this, and the cross-file reviewer confirmed it again. | Explain the exact supported packaging restriction in the public integration note. Preserve the shared harness unless its owner supplies a canonical update. |
| Golden loses the source line for a primitive Promise rejection | 17 | Public behaviour.md promises a one-based source line for unhandled rejections. fail(event.reason) depends on an Error stack. Promise.reject('primitive-rejection') produces line 0, and the UI omits it. Exact extracted handler source was executed locally; this was not a full browser or judge run. The current S13 uses new Error, so the existing scripted pass does not cover this case. | Preserve authored source location for supported non-Error rejections in the golden, then exercise that case as well as the existing Error-object case. |
| Coverage gaps | 26 | Current probes do not distinguish invalid NEW title creation from valid update validation, complete-HTML asynchronous line offsets from synchronous offsets, or elapsed duration on failed/stopped/timed-out runs from success-only duration. The public requirements cover these outcomes. The server non-evaluation promise also has no distinguishing evidence. | Reuse existing title/error/lifecycle setups to observe the missing branches. Treat absolute server non-evaluation as an assurance-policy question: browser roundtrips alone cannot prove it. Do not invent a private-source inspection criterion or pretend it has been verified. |
| Rollback and later execution lose independent credit | 28 | Four JS/HTML/timer/Promise rollback rows require both restoration of the last good preview and a later successful Run. A product can implement one correctly while the other fails, yet receive no credit for either. Existing raw observations already record restoration and recovery separately. | Keep the shared scenarios and actions, assign independent outcome credit, and redistribute the existing weights. Do not repeat the setup or raise shared budgets. |
| Missing successful finite-loop control | 30 | S09 exercises three infinite loops but no ordinary finite loop. A broken instrumenter that immediately aborts every loop can meet the written early-marker/time-limit/recovery observations. A synthetic in-memory witness demonstrates this omission; it is not a measured weak-app judge score. | Add short successful finite-loop controls to establish actual loop support before crediting timeout protection. |
| Isolation check assumes a static host tab title | 27, 31 | S05 records the host title before Run and demands exactly the previous value afterward. A correctly isolated app can update its own title with Run status, while every attempted snippet parent access is blocked. This legitimate UI behavior can be falsely failed. | Check for the snippet's forbidden write and genuine boundary violations while permitting the app's own status/title changes. |
| Duration label can pass without measurement | 32 | S16 only observes a plausible numeric label on immediate runs. The existing raw predicate accepts a constant '3.8 ms'. That does not distinguish actual elapsed measurement from a hardcoded value. | Compare a quick Run and an already-required successful delayed control, allowing broad overhead, units and rounding. Avoid a fragile one-second boundary. |
| Restart success and cleanup are unsafe in adverse cases | 21, 49 | The shared helper can continue after the old process ignores TERM, launch a replacement that cannot bind, then report success from the old listener. It does not require old-group death or new-PID liveness. Cleanup also waits without a bound after TERM. The normal golden restart succeeded; these adverse witnesses were not executed. | Report the inherited conflict to the template owner. An approved shared fix should bound shutdown and cleanup and verify actual replacement. Do not silently edit the task's frozen harness. |

The primary source locations and exact counterexamples are in the linked row reports. Multiple QC rows flag the same underlying contract or helper problem; they are not independent new bugs. No finding was dismissed because more reviewers passed a related row.

## Reconciliation decision

The initial independent totals were 37 Pass, 10 Fail, 5 Not exercised and 1 Note. Row 31's concrete host-title witness also applies to row 27, which initially passed. After all independent reviews finished, the original row-27 reviewer independently confirmed that witness and issued [adjudication-27.json](adjudication-27.json). The original [27.json](rows/27.json) remains untouched. The final table and workbook use the revised Fail, producing 36 Pass and 11 Fail. No Fail was changed to Pass, and no measurement gap was waived.

The earlier three full reviews used the same frozen candidate but different review assignments and contexts. Their failure to identify these defects demonstrates a local review blind spot. It is not evidence of a portal bug or proof that identical complete portal inputs were judged inconsistently. The [row-4 comparison](row04-review-comparison.json) preserves the bounded comparison.

## Evidence that is available

- Candidate input SHA256: `a6a5219e9c5aa5e19c2b30acb01ca3a1719938a02ea09674cd18e08987bf43a9`. All 53 original reports have this identity and distinct reviewer names.
- Candidate ZIP SHA256: `9f63a6bde530883634502471f80c707e8f2362c6e612a080bade7d731255aa07`. The packaging review found all 50 task files match the archive exactly.
- The final canonical pipeline reconciliation validates the unchanged task, workbook, skill, template and checker/policy hashes. Local preflight passes. Its older three-review result remains BLOCKED and does not incorporate this supplemental audit; never use that older report alone to clear the findings above.
- Fresh local [preflight](fresh-preflight.json), [regression guards](fresh-guards.json), parser results and all [48 deterministic dispositions](deterministic.json) are preserved. The private hosted checkers were not run.
- Existing [scripted golden evidence](../golden/RUN.md) passes 58 prescribed Functional facts with one actual PID change, 16 to 335, in 98.027 seconds overall. It is not the complete configured LLM judge and does not cover every public behavior or the newly identified primitive rejection case.
- [Primitive-rejection reproduction](primitive-rejection-source-result.json) executes the extracted handler. [Loop-control reproduction](loop-control-source-result.json) uses a deliberately broken synthetic instrumenter with the exact frozen fixtures. Neither claims an Oracle or model grade.
- Actual scorer execution on synthetic dimension scores verifies gradation, floor/gate behavior and numerical monotonicity. Those inputs are not measured app grades.

## Evidence still needed

Rows 11, 22, 39, 40 and 42 remain Not exercised: full configured-judge workload, complete verifier launch/grading, weak-app floor behavior, discrimination between partial apps, and ranking across stronger/weaker apps. Row 15 is a Note with an unmeasured fresh image-build assurance. Additional source-Pass rows explicitly state the limits of their runtime evidence.

In particular, a generic literal-echo runner with real shared storage has a conditional 0.4330 score path if the gate judge chooses literal-only source and awards full craft. The gate also permits computed source that would defeat it. This is a measurement candidate, not a confirmed false pass or a predicted model score. Keep the actual gate snippet and observations when measuring it.

Oracle 1.0 and Luna 0.40-0.50 remain targets, not measured results. No paid provider run, portal upload, external message, task-source modification, harness modification, commit or push was performed during this dedicated audit. The existing ZIP remains a review candidate and is not cleared for upload.

## Follow-up order

Fix the confirmed golden and task-local rubric issues in a new candidate, retaining independent credit and reusing browser observations. Resolve inherited harness issues through the shared-template owner. Freeze the new source and rerun the affected golden cases, both gates and regression checks; the current reports cannot clear changed bytes. Complete the required configured-judge measurements and independent review before release. Do not increase canonical budgets or alter scoring policy to bypass the findings.
