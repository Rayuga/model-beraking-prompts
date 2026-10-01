# Colderwater: repaired candidate and completed QC round

Local status: **BLOCKED**. Input: `6a1e1645d3f5518ba2b935fdb339053a96ae6cbfbaeb48546616d752f3133ca2`.

Quality records: **{'Pass': 42, 'Fail': 3, 'Not exercised': 5, 'Note': 3}**. Deterministic records: **{'Note': 11, 'Pass': 31, 'N-A': 5, 'Fail': 1}**.

This was one audit round, using a separate fresh context for each assigned quality row plus a separate complete deterministic review. Row 46 records an automatic-review block; it is not a completed isolation investigation. No finding was discarded by majority vote. The root workbook and Harbor QC skill were used. Manual deterministic reviews are not executions of private portal scripts.

## Applied task fixes

- The golden installer refuses unsafe database resets, including when it cannot establish that a running unprivileged app has closed the database.
- The runtime note correctly describes HOME as staging, which may differ from the server directory.
- The rubric observes pending JS replaced by HTML/CSS, and independently grades a later interaction error's message, source line and last-good restoration.
- Unsupported-code probes have distinctive authored output if they execute. Clear native refusals are accepted; quoted source is not mistaken for execution.

Product difficulty is retained. There are 79 Functional outcomes across 23 shared protocols. The protected harness, budgets and scoring policy remain byte-identical to the template.

## Measured validation

- Current scripted golden: 79/79 Functional facts, both gates, six Polish facts and eleven runtime regressions passed, including one real restart (140.066 seconds). This does not establish a configured LLM grade or its completion time.
- 50/50 local structural checks, 64/64 source guards, shell syntax and Linux argument admission for all five judges passed.
- Fresh agent-image build/offline smoke and installer lifecycle controls passed. All solution files match local commit `d03d98d1815f1c3e0b40f2ce622edd48d089d3e6`.
- A focused visual probe showed visible preview content in viewport/frame images and reproduced an offscreen mobile full-page capture omission. It did not establish a universal explanation for older desktop captures or a Visual grade.

[Raw evidence and hashes](raw-evidence-index.json) · [Local proof summary](LOCAL_PROOF_SUMMARY.json) · [Detailed repair status](REPAIR_STATUS.md) · [Complete workbook](QC_REVIEW.xlsx)

## Qualified and non-pass records

Risk=true records remain unresolved. The packaging Note at row 50 has risk=false and is informational; it does not block clearance. The three failed quality rows and one failed deterministic row overlap on shared-harness concerns, rather than representing four new product defects.

| Row | Check | Verdict | Risk | Original evidence |
|---|---|---|---|---|
| 7 | task_asks_for_a_real_working_product | Pass | True | [Report](per-row-review/rows/07.json) |
| 11 | timeouts_fit_the_work | Fail | True | [Report](per-row-review/rows/11.json) |
| 18 | solution_covers_every_graded_dimension | Pass | True | [Report](per-row-review/rows/18.json) |
| 21 | verifier_entrypoint_is_safe_and_always_scores | Fail | True | [Report](per-row-review/rows/21.json) |
| 22 | verifier_image_can_launch_and_grade | Not exercised | True | [Report](per-row-review/rows/22.json) |
| 26 | dimensions_cover_every_graded_requirement | Note | True | [Report](per-row-review/rows/26.json) |
| 30 | negative_checks_have_positive_controls | Pass | True | [Report](per-row-review/rows/30.json) |
| 35 | core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be | Fail | True | [Report](per-row-review/rows/35.json) |
| 39 | floor_is_low_for_shells_mocks_and_stuffing | Not exercised | True | [Report](per-row-review/rows/39.json) |
| 40 | reward_is_graded_not_binary_and_discriminates | Not exercised | True | [Report](per-row-review/rows/40.json) |
| 42 | reward_ranking_is_monotone | Not exercised | True | [Report](per-row-review/rows/42.json) |
| 43 | gates_apply_before_shaping_and_carry_no_reward_mass | Note | True | [Report](per-row-review/rows/43.json) |
| 46 | tests_and_key_are_out_of_agent_reach | Not exercised | True | [Report](per-row-review/rows/46.json) |
| 50 | task_folder_holds_only_task_files | Note | False | [Report](per-row-review/rows/50.json) |

Shared-template findings remain actionable: readiness lacks an absolute deadline; restart can report success while the old process serves; cleanup can hang; scored-suite errors can retain misleading grade metadata. The inherited implementation-stack mandate also exceeds what the permitted browser observations establish. These are not silently waived or patched in protected task files.

The configured paid judge, hosted Oracle, target-builder score and empirical weak-app reward ranking remain unmeasured. Spending approval for the previously prepared single configured run has not arrived. Repeating unchanged source reviews cannot supply those measurements or settle shared-policy changes.

Automatic review previously rejected the isolation reviewer's investigation as a possible cybersecurity risk. No blocked probe was retried; row 46 remains incomplete. That rejection is not evidence of a product defect.

## All 53 quality records

| Row | Check | Verdict | Risk | Evidence |
|---|---|---|---|---|
| 1 | instruction_is_a_natural_product_request | Pass | False | [Report](per-row-review/rows/01.json) |
| 2 | instruction_preserves_natural_human_voice | Pass | False | [Report](per-row-review/rows/02.json) |
| 3 | instruction_is_spelled_right_and_uncontaminated | Pass | False | [Report](per-row-review/rows/03.json) |
| 4 | instruction_states_deliverables_and_runtime_contract | Pass | False | [Report](per-row-review/rows/04.json) |
| 5 | instruction_leaks_no_grader_machinery | Pass | False | [Report](per-row-review/rows/05.json) |
| 6 | instruction_is_achievable_and_unambiguous_in_the_environment | Pass | False | [Report](per-row-review/rows/06.json) |
| 7 | task_asks_for_a_real_working_product | Pass | True | [Report](per-row-review/rows/07.json) |
| 8 | task_identity_is_coherent | Pass | False | [Report](per-row-review/rows/08.json) |
| 9 | agent_environment_and_network_posture_are_correct | Pass | False | [Report](per-row-review/rows/09.json) |
| 10 | verifier_is_isolated_pinned_and_credentialed | Pass | False | [Report](per-row-review/rows/10.json) |
| 11 | timeouts_fit_the_work | Fail | True | [Report](per-row-review/rows/11.json) |
| 12 | no_prebuilt_image_shadows_the_agent_dockerfile | Pass | False | [Report](per-row-review/rows/12.json) |
| 13 | assets_match_the_task | Pass | False | [Report](per-row-review/rows/13.json) |
| 14 | seed_data_is_internally_consistent_and_clean | Pass | False | [Report](per-row-review/rows/14.json) |
| 15 | dockerfile_builds_the_declared_world | Pass | False | [Report](per-row-review/rows/15.json) |
| 16 | environment_does_not_leak_the_answer | Pass | False | [Report](per-row-review/rows/16.json) |
| 17 | solution_covers_every_deliverable | Pass | False | [Report](per-row-review/rows/17.json) |
| 18 | solution_covers_every_graded_dimension | Pass | True | [Report](per-row-review/rows/18.json) |
| 19 | solution_honors_the_runtime_contract_and_is_self_contained | Pass | False | [Report](per-row-review/rows/19.json) |
| 20 | solution_is_frozen_and_deterministic | Pass | False | [Report](per-row-review/rows/20.json) |
| 21 | verifier_entrypoint_is_safe_and_always_scores | Fail | True | [Report](per-row-review/rows/21.json) |
| 22 | verifier_image_can_launch_and_grade | Not exercised | True | [Report](per-row-review/rows/22.json) |
| 23 | verifier_and_instruction_agree_on_the_runtime_contract | Pass | False | [Report](per-row-review/rows/23.json) |
| 24 | grading_wiring_is_structurally_correct | Pass | False | [Report](per-row-review/rows/24.json) |
| 25 | judge_prompts_drive_the_browser | Pass | False | [Report](per-row-review/rows/25.json) |
| 26 | dimensions_cover_every_graded_requirement | Note | True | [Report](per-row-review/rows/26.json) |
| 27 | no_criterion_grades_the_unrequired | Pass | False | [Report](per-row-review/rows/27.json) |
| 28 | criteria_are_independent_and_noncontradictory | Pass | False | [Report](per-row-review/rows/28.json) |
| 29 | global_browser_gate_is_present_and_correct_in_every_dimension | Pass | False | [Report](per-row-review/rows/29.json) |
| 30 | negative_checks_have_positive_controls | Pass | True | [Report](per-row-review/rows/30.json) |
| 31 | plural_asks_are_checked_across_all_matches | Pass | False | [Report](per-row-review/rows/31.json) |
| 32 | criteria_are_outcome_based_and_browser_decidable | Pass | False | [Report](per-row-review/rows/32.json) |
| 33 | criterion_description_is_self_consistent | Pass | False | [Report](per-row-review/rows/33.json) |
| 34 | interactive_time_varying_and_viewport_behavior_is_exercised | Pass | False | [Report](per-row-review/rows/34.json) |
| 35 | core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be | Fail | True | [Report](per-row-review/rows/35.json) |
| 36 | grader_probes_are_not_pre_satisfied | Pass | False | [Report](per-row-review/rows/36.json) |
| 37 | later_dimensions_tolerate_earlier_mutations | Pass | False | [Report](per-row-review/rows/37.json) |
| 38 | batched_criteria_are_scored_independently | Pass | False | [Report](per-row-review/rows/38.json) |
| 39 | floor_is_low_for_shells_mocks_and_stuffing | Not exercised | True | [Report](per-row-review/rows/39.json) |
| 40 | reward_is_graded_not_binary_and_discriminates | Not exercised | True | [Report](per-row-review/rows/40.json) |
| 41 | binary_and_likert_fit_the_ask | Pass | False | [Report](per-row-review/rows/41.json) |
| 42 | reward_ranking_is_monotone | Not exercised | True | [Report](per-row-review/rows/42.json) |
| 43 | gates_apply_before_shaping_and_carry_no_reward_mass | Note | True | [Report](per-row-review/rows/43.json) |
| 44 | dimension_and_criterion_weights_are_honest | Pass | False | [Report](per-row-review/rows/44.json) |
| 45 | judges_are_injection_resistant | Pass | False | [Report](per-row-review/rows/45.json) |
| 46 | tests_and_key_are_out_of_agent_reach | Not exercised | True | [Report](per-row-review/rows/46.json) |
| 47 | verifier_is_deterministic_and_offline_pinned | Pass | False | [Report](per-row-review/rows/47.json) |
| 48 | dimension_prompts_are_accurate_and_consistent | Pass | False | [Report](per-row-review/rows/48.json) |
| 49 | cross_file_runtime_contract_is_consistent | Pass | False | [Report](per-row-review/rows/49.json) |
| 50 | task_folder_holds_only_task_files | Note | False | [Report](per-row-review/rows/50.json) |
| 51 | everything_parses_and_would_run | Pass | False | [Report](per-row-review/rows/51.json) |
| 52 | task_security_and_secrets | Pass | False | [Report](per-row-review/rows/52.json) |
| 53 | task_is_distinct_and_authored | Pass | False | [Report](per-row-review/rows/53.json) |

No upload or push was performed. This report is not a portal-pass, Oracle-1 or target-score guarantee. Any later source/policy/checker change requires appropriate new candidate validation.
