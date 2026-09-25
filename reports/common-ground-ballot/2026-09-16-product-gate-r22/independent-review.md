# Independent review of the r22 product gate

**No material contradiction, added score contribution or unresolved seed-order dependency was found.** Reviewed the changed Render judge, Render prompt and package README. No task source was edited by this reviewer.

- The unchanged shared authentication gate remains nonmutating. The Render introduction separately authorizes a fresh, uniquely identified ballot and its normal create/Open/vote/Close/Publish journey. Existing ballots are not used or reset.
- `working_ballot_journey` is a minimum working-product prerequisite inside Render's existing `all_pass` gate. It adds no final reward mass. Revision arithmetic, detailed result mathematics, privacy, validation, receipts, recovery and appearance retain their existing owners. Workspace navigation remains independently judged.
- The core journey requires five writes once, reusing the authenticated contexts. The prompt explicitly permits conditional normal membership activation/restoration if no Member is active; this is setup outside those five core writes, not another membership test. The criterion now explicitly distinguishes the core journey from conditional roster setup, resolving the possible five-write-cap ambiguity. No extra process restart or repeated Functional matrix is requested.
- `order-score/order-and-score-results.json` and its driver exercise installed RewardKit discovery, scheduling and aggregation while substituting only offline judge responses. They show strict serial Constraints→Functional→Polish→Render→Visual execution and peak concurrency one. Render's new fixture therefore follows Functional's seed inspection. With every criterion passing, final reward is 1; with only the new prerequisite failing, Render and final reward are 0 despite every other dimension scoring 1.
- The targeted real-MCP golden workflow passed twice on the same database, confirmed by `gate-golden/runner.log`, the retained first-run artifacts and the second run's fresh-record evidence. The publish-no-op mutant returned HTTP 200 yet remained Closed; `gate-publish_stub/mcp-recovery-product-gate-verdict.json` correctly rejects it after the protected reread. A status code or toast cannot substitute for saved business state.

The targeted workflow is consistent with the unchanged 600-second Render budget, but these executions do not measure autonomous judge reasoning time. They are not a fresh scored Oracle/model run. The read-only/create-only refusal-mutant diagnostics were still being repaired during this review and are not counted here as completed negative tests. A platform QC/full judge run remains the authority for final acceptance.

## Final control addendum

The pending controls are now resolved. The final `gate-run-results.json` reports all four targeted controls passed. Their observed browser evidence shows:

| Control | Observed outcome |
| --- | --- |
| Golden | Completes the fresh saved ballot workflow, including two runs on the same database. |
| Read-only | Real authentication and populated reads work; Create returns observed HTTP 405. |
| Create-only | Create succeeds; Open returns observed HTTP 405. |
| Publish no-op | Publish returns HTTP 200, but the protected reread remains Closed. |

`order-score/observed-control-score-results.json` feeds these observed workflow verdicts through actual RewardKit aggregation and the unchanged final scorer, deliberately setting every other criterion to its maximum. All three incomplete implementations still receive maximum possible reward **0.0**. Golden's corresponding upper bound is **1.0**, not a newly measured full Oracle score. Earlier HTTP-403/harness-timeout diagnostics are excluded from this final evidence. No task source was changed for this addendum.
