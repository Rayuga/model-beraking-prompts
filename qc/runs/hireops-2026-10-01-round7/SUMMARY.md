# Three-review QC result

**BLOCKED** — 3/3 valid independent reports.

Local review only; no verification of portal model, full judge duration, Oracle or target-model score is inferred.

Unresolved findings/evidence gaps: 20. Verdict disagreements: 3.

- reward_is_graded_not_binary_and_discriminates: missing hash-bound measured runtime record
- reward_ranking_is_monotone: missing hash-bound measured runtime record
- timeouts_fit_the_work: missing hash-bound measured runtime record
- verifier_image_can_launch_and_grade: missing hash-bound measured runtime record
## reviewer-1:quality:timeouts_fit_the_work

Not exercised: tests/test.sh suites1500+11100=12600<13200 verifier; gate judges600+600=1200<1500, scored9000+900+900=10800<11100. Current resolved Functional prompt72536 characters/68criteria plus P0 roster adds work; no configured duration measurement. Scripted1.986seconds is not judge workload.

## reviewer-1:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: Canonical tests/test.sh:224 exits after failed scored transport, leaving score.py:56 gate-only interim graded1/no_op0. Inspected runtime/scored-failure-configured/result.json and script confirm this with scored exit73; frozen test.sh and scorer hashes match fixture source. Unapplied proposals do not fix current bytes.

## reviewer-1:quality:verifier_image_can_launch_and_grade

Not exercised: round7-images establishes exact baked files, schema-round7 real installed RewardKit loader resolves88 rows, and Linux MCP probes exercise launch/browser/tools. All use provider-free scripts or synthetic outer transport; no current complete configured GLM launch-and-grade result is available.

## reviewer-1:quality:core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be

Fail: hro_restart at tests/scored/functional/judge.toml:631 relies on actual process replacement. Canonical test.sh:154-178 waits after TERM then trusts any HTTP response. Resistant-process raw fixture shows originalPID44 still serving, replacement EADDRINUSE and ready1/restart success: readback is not reliable proof of restart durability.

## reviewer-1:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Weighted independent outcomes provide nominal spread, but current configured partial-app rewards unmeasured. Six source-mutation witness outputs are Boolean local observations, not configured ranking/discrimination; older frontend hash is not reused as current UI evidence.

## reviewer-1:quality:reward_ranking_is_monotone

Not exercised: Positive weights/means are monotone under fixed gate/floor decisions, but current empirical configured reward ordering is absent. Gate fixtures and source mutations without judge scores cannot establish it.

## reviewer-2:quality:timeouts_fit_the_work

Not exercised: Canonical budgets nest arithmetically: gates600+600<1500, scored9000+900+900<11100, suites12600<13200. Current Functional resolves to72536 characters and68 criteria, including seven P0 seed families. No current configured LLM-judge timing/complete-run record exists; scripted test duration cannot establish fit.

## reviewer-2:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: tests/test.sh cleanup sends TERM then unbounded wait; restart helper also assumes termination. Matching raw resistant-process scripts/commands show original PID44 survives and cleanup does not exit. scored-failure-configured fixture runs unchanged harness with injected gates then scored exit73; score metadata still says graded1/no_op0 though no scored evaluator output exists.

## reviewer-2:quality:verifier_image_can_launch_and_grade

Not exercised: runtime/round7-images.json and schema-round7/discovery/results.json establish actual current image build and installed88-criterion schema loading. coverage/recovery MCP establish real tools. Scored transports in these runs are explicitly synthetic; no current complete configured judge launch-and-grade/Oracle record is available.

## reviewer-2:quality:dimensions_cover_every_graded_requirement

Fail: integration.md mandates Node22/Express/SQLite. All five browser-only judges and constraints gate inspect observable operation, persistence and auth, expressly avoiding implementation/source reads. Seven added P0 rows close seed fidelity coverage but cannot identify server framework or storage engine. This is a preserved shared runtime-policy conflict.

## reviewer-2:quality:core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be

Fail: Functional hro_restart compares saved product facts after verifier.restart_app; current helper in tests/test.sh sends TERM then starts replacement without confirming old process death/new listener identity. Raw resistant-process actual MCP result reports success while original PID44 still serves; replacement hits EADDRINUSE. A surviving in-memory store can appear durable.

## reviewer-2:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: score.py and fractional weighted criteria provide graded mathematical output, and local mutated witnesses demonstrate selected direct behavior changes only. No current configured-judge score distribution for controlled weak/partial/strong apps is supplied; domain/UI/MCP observations cannot establish empirical discrimination.

## reviewer-2:quality:reward_ranking_is_monotone

Not exercised: Weights are positive and no obvious source-level preference for a weaker outcome appears; witness scripts inspect selected direct outcomes only. No paired current configured judge rewards on ordered partial implementations exist, so empirical monotone ranking cannot be cleared.

## reviewer-3:quality:timeouts_fit_the_work

Not exercised: tests/test.sh/task.toml:serial judges1200<1500 gates and10800<11100 scored;12600<13200 verifier. Functional now68 criteria and72536 resolved characters; schema-round7 is loader-only, domain-seed is scripted HTTP. No configured judge duration measures workload fit.

## reviewer-3:quality:verifier_entrypoint_is_safe_and_always_scores

Fail: tests/tools/score.py:main sets graded=1/no_op=0 on gate-only scoring; test.sh exits after failed scored run preserving it. runtime/scored-failure-configured/rewardkit exits73; raw result.json reports graded=1 with unobserved scored dimensions0. Current shared bytes match the witnessed canonical files.

## reviewer-3:quality:verifier_image_can_launch_and_grade

Not exercised: tests/Dockerfile and round7-images provide pinned runtime/browser/CLI; schema-round7 exercises actual RewardKit0.1.7 discovery/command construction, recovery-mcp exercises real browser. No configured GLM judge was invoked; full launch/grading remains required evidence.

## reviewer-3:quality:dimensions_cover_every_graded_requirement

Fail: instruction.md:runtime paragraph and canonical integration require Express/SQLite and DB-independent health. constraints prompt explicitly cannot infer SQLite; test.sh probe_ready accepts HTTPError/fallback /. No submission witness distinguishes these mandatory requirements. P0 now covers initial product seed families, but does not resolve this separate runtime-policy coverage conflict.

## reviewer-3:quality:criteria_are_outcome_based_and_browser_decidable

Fail: hro_restart still trusts restart_app. Frozen test.sh restart heredoc launches after only a SIGTERM grace period, without verifying old-group death/new-process survival. resistant-process raw probe returns originalPID44 unchanged while replacement logs EADDRINUSE and helper ready=1. Other browser protocols including newContext/abort are supported by real MCP evidence.

## reviewer-3:quality:reward_is_graded_not_binary_and_discriminates

Not exercised: Positive45-total Functional weight is spread across68 outcomes and seven seed rows, but domain/witness scripts supply no configured partial-app reward measurements. Required discrimination remains unmeasured in raw-evidence-index.json.

## reviewer-3:quality:reward_ranking_is_monotone

Not exercised: Canonical scoring weights are positive and algebraically monotone in dimension scores; empirical ranking of stronger/weaker submissions is still absent. Added seed weights/account-restart redistribution require current configured evidence, not inherited calibration.

