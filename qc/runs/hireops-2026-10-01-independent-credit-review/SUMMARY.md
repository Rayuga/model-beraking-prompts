# QC round result: three-full

**BLOCKED** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 22. Verdict disagreements: 9.

- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: task.toml:19-28; tests/test.sh:232-252 budgets are gates 1500 plus scored 11100 under verifier 13200, functional judge 9000 under scored; no full configured duration log in run.

## reviewer-1:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: tests/test.sh:162-210 (unchanged from frozen template) sends TERM to old group, waits only 5 seconds, starts a new process, then treats any HTTPError as ready; it never verifies old group gone or new PID alive.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:1-40 declares pinned browser, Playwright MCP, Claude Code and RewardKit packages; no actual image build or full launch log is in this run.

## reviewer-1:quality:dimensions_cover_every_graded_requirement

Fail: instruction.md:9 mandates Express, SQLite and an app that does not use an external backend; tests/gates/constraints/prompt.md:15 explicitly says browser evidence cannot infer SQLite, and all prompts prohibit source inspection.

## reviewer-1:quality:criteria_are_independent_and_noncontradictory

Fail: tests/scored/functional/judge.toml:114-120 hro_offer_id_lifecycle requires both unusual-ID approval and rescission for one binary score; instruction.md:11 and hireops_rules.md:209-215 promise caller-chosen ID support through distinct actions. polish/judge.toml:44-52 also combines landmarks, headings and field labels.

## reviewer-1:quality:floor_is_low_for_shells_mocks_and_stuffing

Not exercised: tests/gates/constraints/judge.toml requires working offer and fresh context; actual static/mock/seed-copy mutation scores were not measured.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: tests/scoring.toml and tests/tools/score.py:25-58 give weighted partial scoring; no measured weak-app score distribution exists.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: tests/scoring.toml:1-10 creates gates/floor; no paired measured better/worse app rewards exist for monotonicity.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: task/tests/test.sh:213-227 budgets gates 1500s and scored 11100s under task/task.toml:31 verifier 13200s; judge timeouts are 600/9000/900/900s. Arithmetic nests, but no configured judge timing run establishes that 77 functional outcomes fit 9000s.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: task/tests/Dockerfile:1-43 declares pinned browser, judge CLI, RewardKit and app deps, but no image build or full configured verifier launch was exercised in this independent review.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Fail: task/instruction.md:9 mandates Node.js, Express and SQLite; environment/instructions/integration.md:3-8 further mandates better-sqlite3. task/tests/scored/functional/prompt.md:3 forbids source/file inspection, and the only restart criterion tests durability, not SQLite or Express. A browser-identical implementation using a different backend can earn full credit despite an explicit implementation requirement.

## reviewer-2:quality:floor_is_low_for_shells_mocks_and_stuffing

Fail: task/tests/gates/constraints/judge.toml requires cross-context readback but not process restart; task/tests/scored/functional/judge.toml hro_restart has only weight 0.5 of 45.0 functional points. An otherwise complete in-memory server can pass the gates and nearly every scored row while discarding all work on restart.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: task/tests/scoring.toml:1-11 is numerically shaped and functional has 77 binary criteria, but no measured weak/partial app run or full configured judge log establishes score spread.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: task/tests/scoring.toml:1-11 gives functionality 0.6 and craft 0.4, but no paired better/worse app run establishes monotone ordering. The persistence undervaluation is recorded in row 44.

## reviewer-2:quality:dimension_and_criterion_weights_are_honest

Fail: task/tests/scored/functional/judge.toml hro_restart assigns 0.5 of the 45 functional weight total; task/tests/scoring.toml:5-11 makes that only 0.0067 of total possible reward. Losing every operational write on process restart is a core contract breach (instruction.md:1,5,13), yet costs under 1%.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: task.toml:22-35 and tests/test.sh:245-263 nest 600<1500, 9000/900<11100, 1500+11100<13200. No full configured judge duration log was supplied; fit is unmeasured.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:1-35 declares pinned runtime, Chromium, Playwright, judge CLI and RewardKit, but image build/full grader launch was not exercised.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Fail: instruction.md:9 mandates Express and SQLite, yet tests/scored/functional/prompt.md:3 bans source/filesystem inspection and gates/constraints/prompt.md:9 says browser evidence cannot infer SQLite. A persistent JSON-backed Node server can satisfy all browser checks while violating the explicit stack mandate.

## reviewer-3:quality:criteria_are_independent_and_noncontradictory

Fail: functional/judge.toml:114-120 hro_offer_id_lifecycle combines unusual-ID approval and rescission into one binary outcome. Correct approval with broken rescission earns zero for both, despite separate product promises. hro_date_validation at :186 also combines create and rescind date refusal.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: tests/scoring.toml:1-10 is shaped, but no current partial/weak-app RewardKit result demonstrates empirical spread; no runtime-evidence.json is in the run.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: tests/scoring.toml:1-10 structurally weights functional 0.6, polish/visual 0.2 each; no controlled paired weak/better app runs establish empirical monotonic ranking.

## reviewer-3:quality:everything_parses_and_would_run

Not exercised: Read-only checks parsed 7 TOML/3 JSON, bash -n on both scripts and node --check on server/index/rules; no CRLF in shell files. Full Docker/RewardKit launch unexercised.

