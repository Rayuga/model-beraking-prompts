# QC round result: three-full

**BLOCKED** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 26. Verdict disagreements: 17.

- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: task.toml:21,29; tests/test.sh:210-227 budgets 1500+11100<13200, judge timeouts 600/9000/900/900; no full configured duration measured. Full configured judge/verifier timing or launch logs were not present in the assigned frozen task.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:1-42 has pinned browser/judge/rewardkit installation; no actual image build or full verifier run in assigned snapshot. Full configured judge/verifier timing or launch logs were not present in the assigned frozen task.

## reviewer-1:quality:dimensions_cover_every_graded_requirement

Fail: instruction.md:3,8; environment/instructions/hireops_rules.md:407-431 promises audit across reload/fresh sign-in; functional/judge.toml:681-730 has no unconditional audit-log persistence check.

## reviewer-1:quality:criteria_are_independent_and_noncontradictory

Fail: tests/scored/functional/judge.toml:681-695 bundles audit text and snapshots over three independently useful action types into one binary result.

## reviewer-1:quality:global_browser_gate_is_present_and_correct_in_every_dimension

Fail: tests/gates/constraints/judge.toml:18-23 requires Recruiter req+offer, tier3 approval and Auditor COMMITTED readback before all scoring; tests/test.sh:210-221 skips scored suite on gate failure.

## reviewer-1:quality:core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be

Fail: tests/scored/functional/judge.toml:681-730; hro_audit_text does not require fresh context; hro_restart comparison makes P4 audit values conditional.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Fail: tests/gates/constraints/judge.toml:18-23 and tests/test.sh:210-221 hard-zero all dimensions if approval unavailable; no empirical discrimination run.

## reviewer-1:quality:reward_ranking_is_monotone

Fail: tests/gates/constraints/judge.toml:18-23 makes approval failure zero every dimension, allowing a wider useful partial product to score below a sparse approval-path app; no empirical ranking run.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: Frozen task tests/test.sh:203-225 nests 1500/11100-second suites within 13200 seconds; functional/judge.toml:4 allows 9000 seconds for 79 criteria. No full configured judge-duration artifact was supplied; workload fit remains unmeasured.

## reviewer-2:quality:solution_covers_every_graded_dimension

Not exercised: Frozen task solution/app/src/index.js:202-410 and public/js/hireops.js:100-360 plausibly cover graded flows. Configured browser judge/oracle was not run, so full criterion success is unobserved.

## reviewer-2:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: Frozen shared template limitation: tests/test.sh:48-55 treats any HTTPError, including 404, as ready. Generated app-restart.sh at tests/test.sh:152-183 sends SIGTERM but never requires the old process group to exit or the new PID to be alive; a response from the old listener satisfies probe_ready. Static source proof; no resistant-process runtime test performed.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: Frozen task tests/Dockerfile:1-44 declares dependencies, but this review did not build the image or launch a full RewardKit grade. No hash-bound launch/grading log was supplied.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Fail: Frozen task instruction.md:9 and integration.md:3-11 mandate /app/app.db honoring DB_PATH and a single local Node process; functional/prompt.md:1 bars source/filesystem reads; constraints/judge.toml:21-29 checks only browser persistence.

## reviewer-2:quality:criteria_are_independent_and_noncontradictory

Fail: Frozen task functional/judge.toml:141-149 bundles duplicate and blank-ID refusal with cross-kind acceptance; :195-203 combines date-only acceptance and several rejection promises; :267-308 bundles distinct role rights and nine band decisions.

## reviewer-2:quality:global_browser_gate_is_present_and_correct_in_every_dimension

Fail: Frozen task constraints/judge.toml:21-29 requires successful tier-3 approval before any scored dimension; test.sh:213-224 stops after failed gate.

## reviewer-2:quality:core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be

Fail: Frozen task functional/judge.toml:725-730 uses restart_app as durability witness, but shared tests/test.sh:152-183 can report restart success while the old process still serves. No actual resistant-process check or full judge run was supplied.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Fail: Frozen task constraints/judge.toml:21-29 and test.sh:213-224 hard-zero a working create/read app on approval failure; functional/judge.toml:267-308 compresses partial role/authority support. No empirical score spread was measured.

## reviewer-2:quality:reward_ranking_is_monotone

Fail: Frozen task constraints/judge.toml:21-29 requires approval to clear any reward, while scoring.toml:1-12 has otherwise weighted functional/polish/visual dimensions.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: task.toml:17-28 and test.sh:212-227 give 600+600<1500 and 9000+900+900<11100<13200; full judge/builder latency unmeasured.

## reviewer-3:quality:solution_honors_the_runtime_contract_and_is_self_contained

Not exercised: solution/solve.sh:1-34 installs to /app and honors DB_PATH; test.sh:97-111 launches Node, but verifier runtime was not exercised.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile:16-45 declares pinned CLI/MCP/RewardKit and runtime dependencies; image launch/grade not exercised.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Fail: instruction.md:9 and frozen template environment/instructions/integration.md:12-14 prohibit outside backend/data services. tests/gates/constraints/judge.toml:25 and all tests/*/*/prompt.md:1 limit review to browser evidence; remote persistence is observationally equivalent. This is a shared-policy limitation, not a request to edit the template.

## reviewer-3:quality:criteria_are_independent_and_noncontradictory

Fail: functional judge.toml hro_accounts bundles 7 logins in one binary 0.5; hro_revision_roles bundles 5 allowed and 2 denied actors in one binary 1.0; hro_anon_read bundles all read families. hro_tier bundles all nine tier/band pairs; one missing pair erases all correct authority decisions.

## reviewer-3:quality:floor_is_low_for_shells_mocks_and_stuffing

Not exercised: gates/constraints judge.toml:23-25 requires create/approve/fresh Auditor readback; no weak-app judge grade observed.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: scoring.toml:5-11 shapes reward and 79 functional/14 polish/6 visual criteria have positive weights; partial-app reward spread unmeasured.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: scoring.toml:1-11 suggests monotone gates/weights; no graded weak/partial/strong comparison observed.

