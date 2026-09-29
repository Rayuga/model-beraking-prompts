# Coldwater harness repair and incomplete-evaluation handling

The final task shell is bound by `review_binding.json`. This review changed only `projects/colderwater-playground-devtools/tests/test.sh`; the coordinator owns the prompt, rubric and public-note edits. No paid judge, hosted Oracle, model run, user preview container or unrelated task was used or modified.

## Final shutdown

The earlier Coldwater shell could block forever in `wait "$APP_PID"` if the current application ignored SIGTERM. This is separate from the already bounded process-restart helper. The repaired outer cleanup is byte-identical to the validated Ridgeline cleanup: preserve the original exit status, ensure reward files, TERM the current recorded process group, wait nominally five seconds, escalate to KILL and wait up to two more seconds, then avoid waiting on any remaining live process. Zombie states do not count as live processes.

`cleanup_fixed_probe_results.json` records seven fresh passing controls: normal app, resistant parent, resistant child, already-exited app, failed gate with resistant app, missing app, and preservation of original exit 23. Resistant cases finished roughly 5.3 seconds after the synthetic reward was written, with no live application process group or HTTP listener remaining. Reward 1 and legitimate gate-zero were preserved. Those numbers are fixture outputs, not a measured Oracle grade.

## Distinguishing evaluator failures

The installed `harbor-rewardkit==0.1.7` runtime was inspected in the existing local verifier image. Its structured details map dimension names to `{score, criteria}`; criterion records contain `id`, `name`, `value`, `raw`, `weight`, optional `reasoning` and optional `error`. Agent timeouts produce zero-valued records with a real `error` field. The canonical scorer only reads aggregate dimension scores, so without an explicit guard a judge timeout or missing browser observation can resemble product failure.

The new task-local shell guard runs after **both** suites. It validates exact dimensions and criterion identities/counts against the copied submitted judge TOMLs; finite normalized values; the submitted weights; summary/detail agreement; valid binary/Likert raw values; and raw/normalized consistency. It treats these conditions as an incomplete evaluation:

- RewardKit exits nonzero, including the outer timeout status.
- A structured criterion contains a real non-null `error`.
- A criterion's own structured `reasoning`, after leading whitespace, starts exactly with `EVALUATION_INCOMPLETE:`.
- Required reports, dimensions or criterion verdicts are missing, malformed or inconsistent.

Only the expected structured criterion fields are inspected. The guard does not scan application output, tool logs, descriptions, arbitrary response strings or a marker embedded inside quoted page text. Prompts reserve the marker for an evaluator setup/transport failure after at most one retry; an observed app failure keeps an ordinary negative verdict. Binary responses keep the standard `score: "no"` shape as a placeholder, subsequently serialized as `raw: "no"`; visual uses score1. A placeholder is never awarded credit.

An invalid evaluation writes `/logs/verifier/evaluation-incomplete.json` with its suite and reason, emits a concise diagnostic, and restores the canonical ungraded zero (`graded=0`, `no_op=1`). It does not publish a partially graded weighted result. Ordinary app failures retain `graded=1`, normal criterion weighting and gate behavior. **The hosted UI may still display the numeric fallback zero; this change labels that evaluation invalid rather than making a tool failure an app pass or promising automatic platform retries.**

An independent final check found that strict raw-string validation would reject otherwise valid RewardKit serializations. The guard now accepts valid equivalent representations: binary booleans, numbers 0/1, and recognized yes/no/true/false/1/0 strings; Likert finite integral numbers or numeric strings within the declared anchor range. The installed package's `Binary.normalize` and `Likert.normalize` were loaded directly and their results recorded in the fixture report. The guard still rejects malformed or out-of-domain values instead of relying on the package's permissive arbitrary-string fallback or out-of-range clamping. It verifies normalized value agreement, so accepting equivalent serialization does not change scores.

`guard_probe_results.json` records 40 fresh controls through the final shell and canonical scorer. They cover successful and legitimately failing app results, real judge errors, leading markers, markers quoted inside reasoning or present only in logs, missing/duplicate/wrong criterion identities, wrong weights, malformed raw values/reasoning/JSON, missing details or dimensions, summary disagreement, nonzero/timeout CLI status, accepted equivalent raw representations, and rejected nonfinite/out-of-range/inconsistent values. Dedicated gate-stage marker/missing-dimension controls verify that scored work is skipped and cannot become a valid partial grade.

## Full orchestration and unchanged components

`harness_regression_results.json` records four fresh full-shell runs: relative-CWD/sanitized unprivileged launch, golden snippet creation and durability through a real MCP process restart, failed-gate short circuit, and missing-entrypoint no-op. All four passed. Only RewardKit's verdict production is stubbed. The application HTTP operations and process restart are real; these are plumbing tests, not a paid semantic evaluation.

`review_binding.json` confirms that the restart helper body, both canonical Python helpers and scoring policy remain unchanged from the prior upload. The helpers and policy also match the current template byte-for-byte. Frozen verifier environment, timeout budgets and zero-weight gates are unchanged. The shell has LF line endings. Existing five restart-helper lifecycle controls remain historical evidence for the identical helper body; they are not counted as five fresh tests here.

The seven cleanup controls were run before the last raw-serialization compatibility adjustment. Binding reconstructs the exact previously tested shell and confirms its recorded SHA-256; only the raw-verdict validation block subsequently changed. The cleanup body and all lifecycle control flow are unchanged, so those seven observations are carried forward by that precise comparison. The 40 guard controls and four full orchestration controls were run on the final shell. No broader rerun is implied.

The workbook's complete 53 quality and 48 deterministic descriptions and all three skill references were reread for scope. The coordinator owns the complete final per-check verdict report; this harness report does not claim an independent hosted pass. The current shared context and all five prompts were reread after the protocol edits: ordinary observed product failures remain local, evaluator failures use the structured diagnostic, and global-prerequisite zeroing explicitly excludes unavailable tooling. No remaining contradictory instruction was found in that scope.

## Time budget and limits

The configured budgets are still Functional 9000 seconds, Polish 900 and Visual 900; their total 10800 fits the scored wrapper 11100. The two gates 600+600 fit wrapper 1500. Both wrapper budgets total 12600 inside the outer 13200, leaving 600 seconds of nominal startup, packaging and cleanup slack. The bounded cleanup removes an unbounded post-score wait.

The final functional rubric has 35 independently weighted checks, with the real process restart moved immediately after basic save/load rather than left at the end. It has roughly 257 seconds per criterion before shared overhead, or 231 after reserving 900 seconds for setup, shared tool repair and final output. This is budget arithmetic, **not evidence that the paid judge completes within it**. `../functional/TIMING_AND_COVERAGE_LEDGER.md` maps all 35 checks and about 66 seconds of explicit waits before ordinary UI/tool/restart costs, identifies removed redundant work, and preserves meaningful positive controls. Ready-made browser setup reduces tooling construction work. Neither a count nor an average licenses guessing unobserved passes.

The remaining uncertainty is provider latency, actual judge traversal time and hosted handling of invalid evaluations. A paid full-suite run is required to measure those. The shell now exposes failures honestly rather than silently accepting timeout-generated zeros as a completed grade. No fixed expected model score or Oracle 1.0 is claimed by this review.
