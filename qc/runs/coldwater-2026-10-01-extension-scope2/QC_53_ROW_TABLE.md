# Completed independent audit before the task repairs

Candidate: `ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8`. These findings belong to the previous frozen bytes, not the repaired candidate.

Quality verdicts: {'Pass': 39, 'Fail': 8, 'Not exercised': 5, 'Note': 1}. All 53 rows have their own independent reviewer report; the 48 deterministic rows have a separate complete report. Verdict: **BLOCKED**. Original reports are preserved.

| Row | Check | Verdict | Risk | Evidence |
|---|---|---|---|---|
| 1 | instruction_is_a_natural_product_request | Pass | False | [Original report](per-row-review/rows/01.json) |
| 2 | instruction_preserves_natural_human_voice | Pass | False | [Original report](per-row-review/rows/02.json) |
| 3 | instruction_is_spelled_right_and_uncontaminated | Pass | False | [Original report](per-row-review/rows/03.json) |
| 4 | instruction_states_deliverables_and_runtime_contract | Pass | False | [Original report](per-row-review/rows/04.json) |
| 5 | instruction_leaks_no_grader_machinery | Pass | False | [Original report](per-row-review/rows/05.json) |
| 6 | instruction_is_achievable_and_unambiguous_in_the_environment | Pass | False | [Original report](per-row-review/rows/06.json) |
| 7 | task_asks_for_a_real_working_product | Pass | True | [Original report](per-row-review/rows/07.json) |
| 8 | task_identity_is_coherent | Pass | False | [Original report](per-row-review/rows/08.json) |
| 9 | agent_environment_and_network_posture_are_correct | Pass | False | [Original report](per-row-review/rows/09.json) |
| 10 | verifier_is_isolated_pinned_and_credentialed | Pass | False | [Original report](per-row-review/rows/10.json) |
| 11 | timeouts_fit_the_work | Fail | True | [Original report](per-row-review/rows/11.json) |
| 12 | no_prebuilt_image_shadows_the_agent_dockerfile | Pass | False | [Original report](per-row-review/rows/12.json) |
| 13 | assets_match_the_task | Pass | False | [Original report](per-row-review/rows/13.json) |
| 14 | seed_data_is_internally_consistent_and_clean | Pass | False | [Original report](per-row-review/rows/14.json) |
| 15 | dockerfile_builds_the_declared_world | Pass | False | [Original report](per-row-review/rows/15.json) |
| 16 | environment_does_not_leak_the_answer | Pass | False | [Original report](per-row-review/rows/16.json) |
| 17 | solution_covers_every_deliverable | Pass | False | [Original report](per-row-review/rows/17.json) |
| 18 | solution_covers_every_graded_dimension | Pass | False | [Original report](per-row-review/rows/18.json) |
| 19 | solution_honors_the_runtime_contract_and_is_self_contained | Fail | True | [Original report](per-row-review/rows/19.json) |
| 20 | solution_is_frozen_and_deterministic | Pass | False | [Original report](per-row-review/rows/20.json) |
| 21 | verifier_entrypoint_is_safe_and_always_scores | Fail | True | [Original report](per-row-review/rows/21.json) |
| 22 | verifier_image_can_launch_and_grade | Not exercised | True | [Original report](per-row-review/rows/22.json) |
| 23 | verifier_and_instruction_agree_on_the_runtime_contract | Fail | True | [Original report](per-row-review/rows/23.json) |
| 24 | grading_wiring_is_structurally_correct | Pass | False | [Original report](per-row-review/rows/24.json) |
| 25 | judge_prompts_drive_the_browser | Pass | False | [Original report](per-row-review/rows/25.json) |
| 26 | dimensions_cover_every_graded_requirement | Fail | True | [Original report](per-row-review/rows/26.json) |
| 27 | no_criterion_grades_the_unrequired | Pass | False | [Original report](per-row-review/rows/27.json) |
| 28 | criteria_are_independent_and_noncontradictory | Pass | False | [Original report](per-row-review/rows/28.json) |
| 29 | global_browser_gate_is_present_and_correct_in_every_dimension | Pass | False | [Original report](per-row-review/rows/29.json) |
| 30 | negative_checks_have_positive_controls | Pass | False | [Original report](per-row-review/rows/30.json) |
| 31 | plural_asks_are_checked_across_all_matches | Pass | False | [Original report](per-row-review/rows/31.json) |
| 32 | criteria_are_outcome_based_and_browser_decidable | Fail | True | [Original report](per-row-review/rows/32.json) |
| 33 | criterion_description_is_self_consistent | Pass | False | [Original report](per-row-review/rows/33.json) |
| 34 | interactive_time_varying_and_viewport_behavior_is_exercised | Pass | False | [Original report](per-row-review/rows/34.json) |
| 35 | core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be | Fail | True | [Original report](per-row-review/rows/35.json) |
| 36 | grader_probes_are_not_pre_satisfied | Pass | False | [Original report](per-row-review/rows/36.json) |
| 37 | later_dimensions_tolerate_earlier_mutations | Pass | False | [Original report](per-row-review/rows/37.json) |
| 38 | batched_criteria_are_scored_independently | Pass | False | [Original report](per-row-review/rows/38.json) |
| 39 | floor_is_low_for_shells_mocks_and_stuffing | Not exercised | True | [Original report](per-row-review/rows/39.json) |
| 40 | reward_is_graded_not_binary_and_discriminates | Not exercised | True | [Original report](per-row-review/rows/40.json) |
| 41 | binary_and_likert_fit_the_ask | Pass | False | [Original report](per-row-review/rows/41.json) |
| 42 | reward_ranking_is_monotone | Not exercised | True | [Original report](per-row-review/rows/42.json) |
| 43 | gates_apply_before_shaping_and_carry_no_reward_mass | Note | True | [Original report](per-row-review/rows/43.json) |
| 44 | dimension_and_criterion_weights_are_honest | Pass | False | [Original report](per-row-review/rows/44.json) |
| 45 | judges_are_injection_resistant | Pass | False | [Original report](per-row-review/rows/45.json) |
| 46 | tests_and_key_are_out_of_agent_reach | Not exercised | True | [Original report](per-row-review/rows/46.json) |
| 47 | verifier_is_deterministic_and_offline_pinned | Pass | False | [Original report](per-row-review/rows/47.json) |
| 48 | dimension_prompts_are_accurate_and_consistent | Pass | False | [Original report](per-row-review/rows/48.json) |
| 49 | cross_file_runtime_contract_is_consistent | Fail | True | [Original report](per-row-review/rows/49.json) |
| 50 | task_folder_holds_only_task_files | Pass | False | [Original report](per-row-review/rows/50.json) |
| 51 | everything_parses_and_would_run | Pass | False | [Original report](per-row-review/rows/51.json) |
| 52 | task_security_and_secrets | Pass | False | [Original report](per-row-review/rows/52.json) |
| 53 | task_is_distinct_and_authored | Pass | False | [Original report](per-row-review/rows/53.json) |

Read row 18 together with [its evidence correction](row18-evidence-correction.json). An earlier screenshot claim was retracted; all raw attempts remain. Row 46 was not completed because automatic review rejected the isolation investigation for possible cybersecurity risk; that rejection establishes no product defect.

The complete workbook is [QC_REVIEW.xlsx](QC_REVIEW.xlsx). Runtime measurements required for clearance remain absent; an exported workbook is not acceptance.
