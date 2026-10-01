# QC round result: three-full

**BLOCKED** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 24. Verdict disagreements: 17.

- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: Frozen task/task.toml:18,21,27 and tests/test.sh:213-227 nest 1500+11100<13200, with functional judge.toml:4 9000<11100; full workload not measured. Required configured verifier/judge or comparative runtime measurement is absent; scripted golden checks are insufficient.

## reviewer-1:quality:verifier_entrypoint_is_safe_and_always_scores

Note: Frozen task/tests/test.sh:14-33 zeroes and traps reward, :72-117 checks app and launches unprivileged, :213-227 orders suites. Shared cleanup at :34-41 has unbounded wait after SIGTERM; resistant-process behavior untested.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: Frozen task/tests/Dockerfile:1-29 ships versioned CLI/MCP/browser/runtime packages; full verifier image launch and grade unmeasured. Required configured verifier/judge or comparative runtime measurement is absent; scripted golden checks are insufficient.

## reviewer-1:quality:dimensions_cover_every_graded_requirement

Fail: Frozen task/instruction.md:9 mandates DB-independent GET /api/health and Node/Express/SQLite; tests/test.sh:48-57 accepts HTTPError as ready and no criterion checks health status or stack.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Frozen task/scoring.toml:1-10 and functional/judge.toml:21 onward offer many partial outcomes; no configured judge score spread measured. Required configured verifier/judge or comparative runtime measurement is absent; scripted golden checks are insufficient.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: Frozen task/scoring.toml:1-10 favors functionality; empirical better/worse ordering under configured judge unmeasured. Required configured verifier/judge or comparative runtime measurement is absent; scripted golden checks are insufficient.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/task.toml:27 — 13200s verifier encloses 1500s gates + 11100s scored, with 600s gate and 9000/900s scored judge timeouts; no current full configured judge duration is measured.

## reviewer-2:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/tests/test.sh:33 — cleanup sends SIGTERM to the process group and waits without bound at line 37; restart helper lines 152-183 may report the old server as newly ready.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/tests/Dockerfile:16 — Pinned CLI/browser/runtime source is present; full verifier image launch and complete configured RewardKit grading were not exercised on this frozen review.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Fail: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/instruction.md:9 — Node.js, Express and SQLite are mandatory, yet functional/prompt.md:1 limits evidence to browser UI and observed requests; a JSON-file backed Node server can satisfy browser behavior without SQLite.

## reviewer-2:quality:floor_is_low_for_shells_mocks_and_stuffing

Fail: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/tests/scored/functional/judge.toml:626 — Restart durability is only 0.5 of 45 functional criterion-weight units; a fully interactive server with memory-only state can pass the shared-context gate and lose only 0.0067 total score on restart.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/tests/scored/functional/judge.toml:1 — Weighted rubric is source-valid, but no full configured judge or weak-app reward spread was measured for this frozen input.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/tests/scoring.toml:5 — Functional weight is 0.6 and floor 0.05, but empirical ranking of stronger/weaker apps on the configured judge was not measured.

## reviewer-2:quality:dimension_and_criterion_weights_are_honest

Fail: Frozen .qc-cache/hireops-2026-10-01-after-pull/task/tests/scored/functional/judge.toml:629 — Restart persistence, the defining durable-data promise, has 0.5/45 functional weight: max total reward loss is about 0.0067 for an otherwise complete volatile app.

## reviewer-2:deterministic:check-verifier-contract.py

Fail: Manual documented-check application (private executable unavailable); frozen .qc-cache/hireops-2026-10-01-after-pull/task/tests/test.sh:33 — Manual contract failure: cleanup SIGTERM then unbounded wait; restart lines 152-183 can accept old server HTTP as new ready.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: task.toml:20-33 and tests/test.sh:212-228 give 7200 agent, 600 build, 13200 verifier, 1500 gate, 11100 scored; judge timeout totals fit arithmetically, but no configured-run duration was supplied.

## reviewer-3:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: tests/test.sh:224-226 exits on scored-suite timeout retaining gate-stage score.py:50-58 output marked graded=1/no_op=0 with all scored dimensions zero.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:1-33 declares Node, Playwright MCP, Chromium, judge CLI, RewardKit and app dependencies; no full verifier-image grade log was supplied.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Fail: instruction.md:9 requires Express and SQLite, but tests/gates/constraints/prompt.md:9 explicitly excludes an engine probe; browser-only criteria cannot distinguish SQLite from JSON persistence.

## reviewer-3:quality:criteria_are_independent_and_noncontradictory

Fail: functional/judge.toml:105-113 combines arbitrary-ID creation and rescission; :132-141 combines multiple independent validation outcomes; :573-581 combines five anonymous-write protections into binary bars.

## reviewer-3:quality:criteria_are_outcome_based_and_browser_decidable

Fail: functional/judge.toml:553-572 grades forged derived claims, while hireops_rules.md:26-34 leaves body field names free; functional/prompt.md:13 limits replay to observed shapes.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: tests/scoring.toml:1-10 and functional/judge.toml:18-622 provide partial weighted credit; no current configured judge or weak-app score log supplied.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: tests/scoring.toml:1-10 favors function at 60%; no current weak-versus-strong score evidence establishes empirical ranking.

## reviewer-3:quality:task_is_distinct_and_authored

Not exercised: instruction.md:1-13 and hireops_rules.md:1-430 are product-specific; frozen snapshot has no sibling content for originality comparison.

