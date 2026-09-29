# RewardKit architecture and timeout assessment

**Keep one batched functional judge and reduce repeated browser work through shared, bounded scenarios. Do not switch to `individual`, remove the incomplete-run guard, or average partial chunk scores.** RewardKit 0.1.7 has no native durable criterion checkpoint or same-session chunk/resume option. A custom chunk orchestrator is possible engineering work, but it is substantially larger than the legitimate minimal repair.

This is a read-only assessment of installed `harbor-rewardkit==0.1.7` in image `90f43147cba6` (`colderwater-verifier:20260927-two-findings-fix`), bound to candidate `5d0f1d74ae48e36183c5110aee5b414fb5912aa30361401950e8a248e1e4e78b`. No task file or provider configuration was changed. No paid/provider call was made.

## What the time budgets establish

9,000 seconds is **150 minutes**, not 9 or 15 minutes. Dividing it by 37 criteria gives about **243 seconds per criterion before overhead**; this is an arithmetic average, not a per-criterion allowance or measured runtime. The successful single-attempt nominal maximum for functional/polish/visual is `9000 + 900 + 900 = 10800` seconds, leaving 300 seconds inside the 11,100-second scored wrapper. Gates plus scored wrappers total 12,600 seconds, leaving 600 seconds inside the 13,200-second verifier.

Forced waits, nine privacy paths, routing and contexts demonstrate work, but do not alone prove that 150 minutes is insufficient. No measured full model trajectory establishes the old workload's completion time in this audit. Conversely, the nominal sum is not a guarantee: setup, provider latency, tool calls, output size and retries consume time. RewardKit permits three fresh attempts after a parsed-response `ValueError`, each with the full configured timeout; that possible retry work is not contained by simply summing one timeout per dimension. The shell's outer wrapper remains the hard bound.

## Installed behavior, with source and local witnesses

| Architecture fact | Consequence | Evidence |
|---|---|---|
| Batched mode uses one agent subprocess and waits for `communicate()` before parsing. | No criterion results reach RewardKit's report writer while the process is running. | `rewardkit-source/judges.py:497–560` |
| On judge timeout, it kills that subprocess, discards its accumulated output, and returns a zero-valued `error` row for every criterion in the call. | Earlier reasoning or even emitted structured stdout is not a checkpoint. It is correct for the task guard to mark this an invalid evaluation. | `judges.py:285–303,539–549`; local `batched_stdout_then_timeout` probe |
| Agent `individual` mode invokes each criterion sequentially with the same `judge.timeout`, through a fresh CLI call. | Setting `individual` with timeout 9000 permits up to 37 such calls and increases startup/context cost. It does not split 9000 among criteria. | `judges.py:467–494` |
| Individual results accumulate only in memory; `Reward.scores` is assigned after the whole judge operation returns. | A later criterion timeout can coexist with an earlier success only if the overall loop finishes. The error still makes the final evaluation incomplete. | `reward.py:192–235`; local individual-timeout probe |
| The runner writes `reward.json` and details only after all reward tasks complete. An exception aborts before that writer. | An outer timeout or process error can leave no completed-report files even after some criteria/dimensions ran. | `runner.py:307–334,434–485`; local outer-kill probe |
| The Claude command has neither a resume flag nor streaming output processing. Current MCP registration is stdio and Playwright uses `--isolated`. | Successive agent calls do not have a supported shared conversation/browser/evidence state under the present harness. The application database may persist, but page/context references and routing setup are not guaranteed to. | `agents.py:139–185`; current judge MCP config |

Three unpaid installed-CLI cases confirm the relevant behavior, using a disposable two-criterion rubric and a local agent transport fixture:

1. A batched child printed a valid structured response and then exceeded its one-second fixture timeout. RewardKit exited 0 with **both rows errored**, `raw=null`, score 0 and empty `judge_output`.
2. Individual mode returned a valid first criterion (weight 1) and timed out the second (weight 3). RewardKit exited 0 with score **0.25** and an error on the second row. That score is not a valid complete application grade.
3. An outer kill after the first individual criterion had successfully exited produced **no reward or detail files**. The initial attempt killed Python imports too early; the corrected probe waited for the first-success trace before the kill. That fixture setup correction is retained in the evidence and is not attributed to RewardKit or the app.

See [timeout_semantics_results.json](timeout_semantics_results.json) for cases 1–2 and the initial outer probe, and [timeout_semantics_outer_results.json](timeout_semantics_outer_results.json) for the corrected case 3. The one-second timeouts were in temporary local fixtures only.

## Feasibility of actual chunking

**Logical phases inside the same judge call are compatible now.** A prompt can define shared setup, bounded scenario scripts, a per-criterion evidence ledger and concise final verdicts. Reuse observed facts/setup where appropriate while preserving separate verdicts, meaningful negative controls and local failure attribution. Such a ledger reduces repeated work and forgetting; it is not a durable RewardKit checkpoint and cannot turn a killed call into a completed grade.

**External chunks require a new orchestrator.** It could be embedded in the existing `test.sh` and generate runtime-only subset inputs under `/tmp` or private log directories, keeping the shipped five-folder file list and canonical helpers untouched. That satisfies the closed *archive layout* in principle, but it changes suite orchestration and browser transport/lifecycle from the current staged recipe; it is not an already validated contract-preserving switch.

The installed Playwright MCP advertises `--port` and `--shared-browser-context` for reuse across HTTP clients. Therefore a persistent trusted MCP process is a plausible component. It would need tested lifetime management, isolation from other dimensions, browser-state preservation across reconnects, trusted evidence handoff, explicit cleanup, and a single-use restart policy. Mere reuse of storage files, CDP browser attachment, or reusing a database is not proof that MCP-side page objects, route handlers and evidence references survived. None of this persistence architecture was exercised here.

A correct complete merge would:

- Partition the original criterion IDs exactly once, preserve IDs/types/weights, and reject missing, duplicate, malformed or error-bearing verdicts.
- Persist validated completed chunks as private diagnostic/checkpoint evidence and use a single overall functional deadline. Retry only unfinished work within that budget, with valid state/setup; do not repeat already-consumed restart or assume a timed-out agent left a clean browser state.
- Merge normalized **criterion rows**, calculating `round(sum(weight * value) / sum(original_weights), 4)` once. Do not average rounded chunk scores or renormalize over completed criteria.
- Emit the original single functional-detail object and all required dimension results only after complete valid coverage; then use the unchanged canonical scorer.

RewardKit's own multiple-TOML grouping is not this merge: extra submitted TOMLs violate the closed list; default reward weights yield an average of chunk means, which is wrong for unequal total criterion weights; multiple rewards under the same dimension serialize details as a list, which the current guard correctly rejects (`runner.py:337–364`). A `[judge].weight` workaround conflicts with the current staged profile.

## Minimal recommendation

Proceed with the planned **shared bounded scenarios in the existing functional batch**, retaining the 37 separate verdicts unless the rubric is deliberately redesigned. Reduce repeated fresh records, editing, navigation, control Runs and re-observation without deleting required product behaviors. Explicitly permit sharing **observed evidence and setup**, rather than inheriting another criterion's pass/fail. Keep independent fallback setup where a failed prerequisite would otherwise cascade into unrelated verdicts.

Use actual UI locators once, batch nearby actions in a browser call where timing requires it, collect several independent observables from one successful Run, and reuse one read/request-format discovery within the same scenario. Limit failure/setup retries as already specified. Keep timing-sensitive delayed callbacks and dirty-editor observations explicit rather than substituting source text or guessed requests. A final compact per-criterion evidence check should precede the one structured result.

Do not claim that this necessarily finishes within 9000 seconds until measured. It directly removes repeated work while preserving the standard harness. Do not switch to 37 individual calls, increase concurrent agents on the shared mutable application, or introduce a custom checkpoint pipeline solely to make the time-budget spreadsheet look safe.

**Incomplete work cannot legitimately become partial positive reward under the fixed scorer.** Dropping missing criteria inflates scores; assigning missing criteria zero mislabels evaluator failure as app failure; assigning them pass invents credit. Known completed rows may be retained for diagnostics or a bounded continuation, but if complete valid coverage is not recovered before the deadline, retain `graded=0`, `no_op=1` and the incomplete diagnostic. Fix the workload or execution pipeline, not that distinction.
