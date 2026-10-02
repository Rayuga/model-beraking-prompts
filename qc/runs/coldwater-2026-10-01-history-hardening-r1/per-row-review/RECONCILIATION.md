# R1 reconciliation

All 53 fresh quality reviews and the separate 48-row deterministic review completed before any task correction. Quality: **34 Pass, 15 Fail, 4 Not exercised**. These are failed quality rows, not fifteen distinct implementation defects. The pipeline reports BLOCKED; the task package also fails preflight.

Confirmed task fixes for a new candidate:

| Rows | Cause | Correction |
| --- | --- | --- |
| 18, 19, 50, 51, 52; four deterministic failures | Windows build dependencies shipped under solution/app/node_modules; missing Linux SQLite binding prevents actual installation from starting | Move dependencies into the ignored build cache, rebuild assets there, and test the entire solve.sh installation |
| 17 | Canvas bitmap disappears from restored successful picture | Preserve a static bitmap; test error, Stop and timeout recovery with real user input |
| 20 | Exact new reference and compiled assets uncommitted | Commit the corrected reference before the next freeze |
| 26 | Mandatory initially empty library has no graded observation | Remove that unnecessary mandate; describe the seed truthfully |
| 27 | Lost-response probe rejects valid automatic same-attempt retries | Accept automatic or user-triggered recovery with identical no-extra-write semantics |
| 31, 48 | Leftover all-theme anchor and title-validation mention | Align with current one-appearance review and removed title rules |
| 39 | Literal-string renderer can cross Render and earn above the shared functional floor | Require a basic freshly computed DOM/log result; retain scoring policy and test real apps plus the literal mock |

Rows 11, 22, 40 and 42 need current configured-judge/model evidence. Rows 21 and 32 record the previously deferred shared cleanup/restart limitations. They remain visible and are not converted into passes.

Row 46 is a separate **new shared-template isolation finding**: a low-privilege app can read the private prompt from the judge command line through /proc in the shared PID namespace. The isolated reproduction used a sentinel and an inert CLI, with no provider calls. Direct protected-file reads and reward writes were denied. This is not covered by the earlier restart exception and needs an upstream runner/library decision. No task-specific harness patch is proposed.

Report hygiene: a reviewer import generated a Python bytecode cache beneath frozen rules; no original rule file changed. The generated file was moved to generated-review-cache. A raw row-46 JSON observation was originally written alongside numbered verdicts and was moved intact to per-row-review/evidence/46/46-isolation-probe-result.json. Original row reports retain their original path citations; this note supplies the relocation. After these artifact-only moves, all 54 reports and frozen inputs validate. No verdict was edited, discarded or voted away.

Historical Oracle 1.0 and Luna 0.8564 apply to the previous release. This audit and its scripted observations do not establish new configured grades or a target score near 0.5.
