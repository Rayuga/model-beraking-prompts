# QC round result: three-full

**BLOCKED** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 25. Verdict disagreements: 16.

- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: task.toml:17-28 allows 7200s agent and 13200s verifier; tests/test.sh:213-224 budgets 1500+11100s; judge.toml timeouts are 600,600,9000,900,900. Nesting is static; no full configured duration measured.

## reviewer-1:quality:solution_covers_every_graded_dimension

Not exercised: solution/app/src/app.tsx:44-169 and runtime.ts:350-388 plausibly cover graded dimensions, but no configured Oracle/full judge run established that the reference earns high credit.

## reviewer-1:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: tests/test.sh:153-180 sends SIGTERM to the old group, waits at most five seconds, launches a replacement, then accepts any HTTP response on port 3000. It never requires the old group to exit, new PID liveness or the new PID to own the response. The startup probe at 42-57 also treats HTTP errors as ready.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:1-45 declares pinned Node/Python, Playwright MCP, Chromium, RewardKit and runtime deps; no verifier image build or complete grading launch was observed.

## reviewer-1:quality:dimensions_cover_every_graded_requirement

Fail: environment/instructions/integration.md:13 mandates Express and better-sqlite3 and policy.md:7 calls for local SQLite. tests/gates/constraints/judge.toml:23-29 explicitly says browser retrieval does not prove SQLite or Express; no scored criterion checks either technology. A JSON-file server with equivalent UI could receive full credit.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: tests/scoring.toml:5-11 shapes partial credit, but no hash-bound full judge results for distinct partial apps were reviewed; reward discrimination is unmeasured.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: tests/scoring.toml:5-11 weights function above style, but no comparative scored weak/strong-app runs established empirical monotonic ordering.

## reviewer-1:quality:everything_parses_and_would_run

Not exercised: task.toml, scoring.toml, all five judge.toml, seed JSON and package JSON parsed; bash -n passed solve.sh/test.sh; node --check passed server.js. Docker/image/full app launch was not exercised.

## reviewer-1:quality:task_is_distinct_and_authored

Not exercised: instruction.md:1-9 and task.toml:6-15 are product-specific, but this assignment restricted evidence to the frozen candidate; no sibling task comparison was made to establish distinctness.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: task/task.toml:21-31 and task/tests/test.sh:185-199 nest 600<1500, 9000/900<11100 and 1500+11100<13200; no full configured judge or agent build duration was measured for this 79-outcome functional suite.

## reviewer-2:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: task/tests/test.sh:25-31 cleanup sends TERM then unbounded wait; generated restart helper at :145-174 never confirms old group died or new PID owns port before probe_ready accepts any HTTP response. File is byte-identical to frozen shared template; this is a shared-policy limitation, not a task edit.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: task/tests/Dockerfile:1-33 declares Node, Python, pinned CLI/MCP/npm/RewardKit and Chromium install, but this reviewer did not build the image or run the full configured verifier.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Fail: task/environment/instructions/security.md:9 promises snippets cannot fetch external resources or use network services; task/tests/scored/functional/prompt.md:212-220 grades only fetch and Image delivery. WebSocket/EventSource/sendBeacon/XHR service access has no bounded probe.

## reviewer-2:quality:criteria_are_independent_and_noncontradictory

Fail: task/tests/scored/functional/judge.toml:45-49 makes JavaScript AND complete HTML execution one binary row; :143-147 makes refusal of five distinct unsupported families one binary row. Separate useful promises lose all credit on a sibling failure.

## reviewer-2:quality:criterion_description_is_self_consistent

Fail: task/tests/scored/functional/judge.toml:45-49 and :143-147 each define multiple independently useful full-credit bars under one binary result. A correct JS runner with broken HTML, or a sandbox refusing four of five listed families, receives zero for the combined row.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: task/tests/scoring.toml:1-11 and functional/judge.toml:23-575 provide graded weights, but no hash-bound partial-app full-judge results demonstrate score spread.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: task/tests/scoring.toml:1-11 assigns 0.6 functional and 0.2 each polish/visual with a 0.05 functional floor, but no worse/better paired full-judge measurements establish monotone ranking.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: task/tests/scored/functional/judge.toml:4 allows 9000 seconds for 79 criteria; functional/prompt.md has 23 protocols estimating 458 UI actions plus waits. Gate/scored/verifier budgets nest (1500+11100<13200), but no full configured judge-duration log exists in this run.

## reviewer-3:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: task/tests/test.sh:48-57 and 136-145 catch urllib.error.HTTPError then sys.exit(0), so HTTP 404 counts as ready. The task test.sh is byte-identical to frozen rules/projects/webdev-task-template/tests/test.sh. Source counterexample is independent of a paid run.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: task/tests/Dockerfile:1-36 declares Node, Python, Playwright MCP, Chromium, claude-code and rewardkit; no full image build/launch and configured grading log is bound to this review.

## reviewer-3:quality:verifier_and_instruction_agree_on_the_runtime_contract

Fail: task/environment/instructions/integration.md:5 requires GET /api/health to answer successfully, while task/tests/test.sh:48-57 and 136-145 count HTTPError (including 404/500) as readiness. Shared template source causes this conflict.

## reviewer-3:quality:criteria_are_outcome_based_and_browser_decidable

Not exercised: task/tests/scored/functional/prompt.md:S05/S07/S21/S22/S23 require browser_run_code_unsafe, independent contexts, intercepted network and restart_app. The installed MCP behavior was not exercised here; source recipes alone do not establish end-to-end tool feasibility.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: task/tests/scoring.toml:1-11 and functional/judge.toml give weighted partial criteria, but no hash-bound full judge outputs for partially correct weak apps or discrimination measurement are present.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: task/tests/scoring.toml:1-11 has a plausible 60/20/20 policy, but no measured paired weak/strong app scores establish empirical rank monotonicity.

## reviewer-3:quality:cross_file_runtime_contract_is_consistent

Fail: task/environment/instructions/integration.md:5 requires a successful health response; task/tests/test.sh:48-57 and 136-145 treat any HTTPError as ready. Other port/DB/restart/scoring strings agree, but this readiness conflict can grade a nonworking submission.

