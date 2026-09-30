# Three-review QC result

**STALE_OR_INVALID** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 15. Verdict disagreements: 11.

- live task differs; prepare a new round
- Bootstrap review has no frozen checker/policy implementation; prepare a new round before release
- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: Task paths below are relative to .qc-cache/coldwater-2026-09-29-round1/task/. Static nesting is correct: gate judges 600+600 < tests/test.sh:213 budget 1500; scored 9000+900+900=10800 < line 224 budget 11100; 1500+11100=12600 < task.toml:28 verifier 13200. Golden direct-browser run took 95.41 seconds, but explicitly excludes LLM/provider overhead. Cold-build and configured-judge completion within budgets remain unmeasured.

## reviewer-1:quality:solution_covers_every_deliverable

Fail: Task paths below are relative to .qc-cache/coldwater-2026-09-29-round1/task/. environment/instructions/behaviour.md:19 says ?Keep the old entries between runs until I use Clear console?; solution/app/src/app.tsx:42 instead appends to previous.slice(-999), silently retaining only 1000 entries. The shipped built frontend repeats this at solution/app/public/assets/index-VduTT3aN.js:29019. Existing S16 two-entry history observations do not exercise this limit.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: Task paths below are relative to .qc-cache/coldwater-2026-09-29-round1/task/. tests/Dockerfile:16-38 declares exact judge CLI/MCP/runtime/RewardKit versions and installs the associated Chromium, :43 copies /tests. Byte-equal to template, and matching golden raw local browser/restart ran. A complete build and provider-backed RewardKit grading run were not exercised by this review or the permitted raw evidence.

## reviewer-1:quality:dimensions_cover_every_graded_requirement

Fail: Task paths below are relative to .qc-cache/coldwater-2026-09-29-round1/task/. environment/instructions/integration.md:3 requires TypeScript/React/Vite/Express/SQLite and :5 requires package.json, lockfile and source. tests/test.sh:68 checks only server.js, while tests/gates/constraints/judge.toml:29 explicitly says the gate does not establish SQLite or Express; functional/polish/visual prompts prohibit implementation inspection and contain no structural requirement check. These explicit architecture/deliverable requirements have no enforcement.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Task paths below are relative to .qc-cache/coldwater-2026-09-29-round1/task/. tests/scoring.toml:5-11 and 57 independent binary plus 6 anchored visual rows permit partial scores; synthetic score.py inputs yielded 0.0/0.7/1.0 as intended. The allowed golden evidence is one strong product, not a configured-judge partial-quality comparison; practical discrimination remains unmeasured.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: Task paths below are relative to .qc-cache/coldwater-2026-09-29-round1/task/. score.py:40-48 is monotone in nonnegative dimension values and synthetic gate/floor/partial/full cases behaved correctly. Actual judge rankings across worse/better implementations were not exercised with the permitted golden/focused evidence; no empirical monotonicity claim is made.

## reviewer-1:quality:task_is_distinct_and_authored

Not exercised: Task paths below are relative to .qc-cache/coldwater-2026-09-29-round1/task/. The source and public notes are specifically authored around Colderwater sandbox runs/recovery and SQLite revisions, unlike the placeholder template. No sibling task corpus was reviewed, so the suite-level distinctness comparison required by the check is unmeasured.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: .qc-cache/coldwater-2026-09-29-round1/task/tests/scored/functional/judge.toml:4 ? 9000-second functional budget; other scored judges 900 each, so 10800 < 11100; gates 600+600=1200 <1500; suite budgets 12600 <13200. Functional prompt action estimates total 366. deliverables/colderwater-playground-devtools/last-attempt-repair-2026-09-28/golden/run-golden-20260928-124124/RESULTS.json:wall_seconds is 95.411 direct scripted Playwright, not a GLM/RewardKit completion measurement. Cold Docker build and full judge completion remain unmeasured.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: .qc-cache/coldwater-2026-09-29-round1/task/tests/Dockerfile:all ? Pinned MCP/Chromium install, claude-code, RewardKit 0.1.7, Python restart tool and matching Express/SQLite runtime are present. Raw direct-browser execution demonstrates app/browser/restart capability, but no full separate-verifier image build plus paid judge invocation was exercised in this review.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Fail: .qc-cache/coldwater-2026-09-29-round1/task/environment/instructions/behaviour.md:Saved snippets ? ?Use .js, .html or .css source filenames, case-insensitively.? S02 in tests/scored/functional/prompt.md:128 tests only allowed filename dispatch and S21/S23/S24 save only allowed filenames; no unsupported-extension Save/refusal is exercised. A backend accepting and persisting .txt or .exe snippets can pass every current criterion.

## reviewer-2:quality:negative_checks_have_positive_controls

Fail: .qc-cache/coldwater-2026-09-29-round1/task/tests/scored/functional/prompt.md:168 ? S04 observes cancel-A-started and pending status then suppresses a delayed callback; the separate Stop probe likewise never first demonstrates its timer callback can fire. Descriptions cw_supersede_pending/cw_stop_pending_execution own negative suppression without a matching successful timer. A stub timer that marks a Run pending but never invokes callbacks can earn these rows; initial synchronous logs and recovery do not prove timer capability. S02 has a different explicit timer control but S04 never requests its reuse.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: .qc-cache/coldwater-2026-09-29-round1/task/tests/scoring.toml:weights/floors ? Scorer formula is monotone for increasing dimension scores and offline samples behaved accordingly, but no actual poor/partial/good submissions were judged under the full configured provider; direct golden browser facts do not establish empirical reward ranking.

## reviewer-2:quality:task_is_distinct_and_authored

Note: .qc-cache/coldwater-2026-09-29-round1/task/instruction.md:product scope ? Authored playground-specific execution, rollback and two-editor revision behavior is distinct from the generic template. No complete sibling-task/domain-plan comparison was provided/performed, so uniqueness across the entire suite is not claimed.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: tests/test.sh:run_suite budgets nest arithmetically: sequential gates 600+600=1200<1500, scored 9000+900+900=10800<11100, 12600<13200 outer. Functional prompt has 23 protocols and 366 estimated UI actions. No production claude-code/GLM completion, cold-build or 7200-second agent timing was measured. Hash-matching golden RESULTS.json is direct Playwright (95.41 seconds), explicitly not a judge run; it cannot establish full-judge feasibility.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Fail: environment/instructions/integration.md:3 requires TypeScript, React, Vite, Express and SQLite; :11 requires one local server and no external backend. tests/gates/constraints/judge.toml:description explicitly says its gate establishes shared write/read "not SQLite or Express specifically"; functional prompt:7 prohibits implementation/database inspection and the 57 rows contain no independent stack verification. Behavioral coverage is strong, but these explicit architecture deliverables have no scored or deterministic task-verifier check.

