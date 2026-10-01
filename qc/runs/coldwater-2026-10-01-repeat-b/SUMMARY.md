# QC round result: three-full

**BLOCKED** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 23. Verdict disagreements: 9.

- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: task.toml:19-31 and tests/test.sh:202-227: 600+600<1500, 9000+900+900<11100, 1500+11100<13200; no full configured judge timing was measured.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:1-41 lists browser, judge CLIs, RewardKit and Node runtime dependencies; no Docker image launch or full grading measured.

## reviewer-1:quality:dimensions_cover_every_graded_requirement

Note: Shared-template limitation: frozen rules/projects/webdev-task-template/environment/instructions/integration.md:3-11 mandates Express and better-sqlite3, repeated at task/environment/instructions/integration.md:15. tests/scored/functional/prompt.md:7 expressly forbids submitted source/database inspection; tests/gates/constraints/judge.toml:18-30 proves only browser-observed shared server write/read. A JSON-file-backed Node server could pass the browser rubric while violating the shared technology mandate. The 1 October qc/REVIEW_POLICY.md says to record this shared-policy conflict without rewriting the mandated template. Task-specific public behavior maps forward to S01-S24/S34/S36 in functional/prompt.md:115-487 and to Polish/Visual.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: tests/scoring.toml:1-11 and functional/judge.toml:24-574 define weighted partial scoring; no empirical weak-app discrimination run.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: tests/scoring.toml:1-11 gives functional 0.6, polish 0.2, visual 0.2 and a functional floor; no empirical pairwise ranking run.

## reviewer-1:quality:everything_parses_and_would_run

Not exercised: task.toml, scoring.toml, five judge TOMLs and seed JSON parsed; bash -n test.sh and solve.sh and node --check server.js passed; Docker launch not run.

## reviewer-1:quality:task_is_distinct_and_authored

Not exercised: instruction.md:1-9 and task.toml:5-17 consistently describe the Colderwater code playground; distinctness to all siblings not empirically established.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: tests/scored/functional/judge.toml:4: 9000 < scored suite 11100; gate 600 < 1500; 1500+11100=12600 < verifier 13200. Actual full-judge completion and cold build duration were not measured.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:31: Verifier Dockerfile declares judge CLI, Playwright MCP, Chromium, RewardKit, Python and app runtime deps, but no image build or full grade was run.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Fail: environment/instructions/integration.md:13: The public instruction mandates Express, better-sqlite3, Node built-ins and SQLite, while browser-only judging cannot establish those implementation technologies.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: tests/scoring.toml:6: Weights allow partial scores in source, but no full configured judge run or weak-app score sweep was supplied.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: tests/scoring.toml:6: The functional share exceeds either visual or polish, but empirical monotone ordering across stronger/weaker apps was not measured.

## reviewer-2:quality:task_is_distinct_and_authored

Not exercised: task.toml:14: Authored product-specific content is evident, but this independent frozen snapshot cannot substantiate comparison with sibling tasks.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: task.toml:17,21,27 and tests/test.sh:213,224 nest 1500+11100=12600 below 13200; functional/judge.toml:4 is 9000 below scored 11100. Functional/prompt.md:102,113,115-487 estimates 458 UI actions over 23 protocols; no full configured judge duration or cold-build measurement is present.

## reviewer-3:quality:dockerfile_builds_the_declared_world

Not exercised: environment/Dockerfile:1-25 names pinned Node tag, Express 5.1.0, better-sqlite3 12.4.1, NODE_PATH, instructions/assets COPY, readable permissions and empty git /app. No cold image build was performed in this read-only review.

## reviewer-3:quality:solution_covers_every_graded_dimension

Not exercised: solution/app/src/runtime.ts:24-386, src/app.tsx:1-166 and server.js:1-132 show plausible coverage of 79 functional, 6 polish and 6 visual criteria, but no full oracle/browser judge run on these frozen bytes verifies all outcomes.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:1-45 declares Node/Python, pinned CLI/MCP/RewardKit, Chromium install and app dependencies; actual Docker build, browser launch and full grade were not run.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Fail: Task-added policy.md:7 promises the saved library belongs to the local server and SQLite database, and integration.md:13 explicitly requires Express/better-sqlite3/Node built-ins. Constraints/judge.toml:25-29 proves only a browser-visible server write/read and expressly says it does not establish SQLite or Express; functional/prompt.md:7 forbids implementation/database inspection. All scored outcomes can pass with a durable non-SQLite server.

## reviewer-3:quality:criteria_are_outcome_based_and_browser_decidable

Not exercised: functional/prompt.md:7,13-25 restricts to UI/data exchange and bounded visible evidence; :24-33 and :76-82 require browser_run_code_unsafe/context routing. No installed judge-browser capability or full execution log on frozen input was available to verify feasibility.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: tests/scoring.toml:5-11 shapes functional/polish/visual; functional/judge.toml has 79 weighted binary outcomes and visual/judge.toml:17-105 six 5-point scales. No measured partial-app score spread on frozen inputs is provided.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: tests/scoring.toml:5-11 weights functional 0.6 above polish/visual 0.2 each and uses floor; no actual stronger/weaker app pair scores for this frozen candidate establish empirical ordering.

## reviewer-3:quality:everything_parses_and_would_run

Not exercised: Local tomllib parsed task/scoring/five judges, json parsed seed/package files, bash -n passed solve.sh/test.sh with LF, node --check passed server.js; no Docker build or full verifier startup was run, so would-run remains unmeasured.

## reviewer-3:quality:task_is_distinct_and_authored

Not exercised: instruction.md:1-9 and six notes are specific to this code playground; task.toml:14 explicitly says adapted from supplied Colderwater task. Frozen-only assignment forbids sibling comparison, so clone distinctness is unmeasured.

