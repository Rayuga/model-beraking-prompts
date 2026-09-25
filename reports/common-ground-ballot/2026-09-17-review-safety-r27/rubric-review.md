# Local review against task-implementation.txt

Archetype: authenticated server-backed application with SQLite, anonymous ballots and browser recovery.

Rubric source SHA-256: `f1a9d70fb76ddcbd01b898da714582b0572b94543b597bf9b5d6482f84213da8`.

**This is a local author review, not a platform 53/53 result or scored Oracle run.** The unchanged files were reconciled with the frozen r26 archive; the changed golden and criteria were exercised with real browsers and disposable negative controls. The referenced external review_guidelines.md was not supplied in this workspace; the rubric itself contains its review methodology.

| # | QC criterion | Local finding | Basis |
| --- | --- | --- | --- |
| 1 | `instruction_is_a_natural_product_request` | No issue identified | First-person product request now explains the meeting use case for reviewing and opening a round. |
| 2 | `instruction_preserves_natural_human_voice` | No issue identified | Existing conversational voice retained; additions use concrete shared-tab and shared-computer situations. |
| 3 | `instruction_is_spelled_right_and_uncontaminated` | No issue identified | UTF-8 source and spelling reviewed; no template or evaluator residue in the brief. |
| 4 | `instruction_states_deliverables_and_runtime_contract` | No issue identified | Public brief unchanged. All 66 Functional IDs retain their public requirement and line mapping; two missing concrete roster/receipt cases are now exercised. |
| 5 | `instruction_leaks_no_grader_machinery` | No issue identified | No grader, score, rubric, criterion IDs or private verifier paths in instruction.md. |
| 6 | `instruction_is_achievable_and_unambiguous_in_the_environment` | No issue identified | New cases reuse the existing pair, existing accounts and ordinary membership controls. Full core workflow followed by rounds passed on the same already-mutated database. |
| 7 | `task_asks_for_a_real_working_product` | No issue identified | Full authenticated ballot product with real writes, private voting, durability and review/recovery workflows. |
| 8 | `task_identity_is_coherent` | No issue identified | Slug/name/version coherent; metadata updated to name draft review while keeping standard keys. |
| 9 | `agent_environment_and_network_posture_are_correct` | No issue identified | Public network, synthetic accounts and existing resource values preserved. |
| 10 | `verifier_is_isolated_pinned_and_credentialed` | No issue identified | Separate verifier, pinned packages/model wiring and unchanged verifier.env. |
| 11 | `timeouts_fit_the_work` | No issue identified | Standard agent 7200s; supplied SQLite/auth/session/shell foundation retained. Functional 7200s versus last measured old run 1929s; round plan reuses four pairs, bounded tables and the one restart, with a 20-minute persistence reserve. New full autonomous duration remains unmeasured. Sum12000 < runner12600 < outer13200. |
| 12 | `no_prebuilt_image_shadows_the_agent_dockerfile` | No issue identified | No prebuilt agent image shadows environment/Dockerfile. |
| 13 | `assets_match_the_task` | No issue identified | Seed, starter and all public asset/runtime paths unchanged. |
| 14 | `seed_data_is_internally_consistent_and_clean` | No issue identified | Unchanged authoritative synthetic seed; old and new browser regressions accept it. |
| 15 | `dockerfile_builds_the_declared_world` | No issue identified | Agent Dockerfile/dependencies unchanged from the deployed working package; final local validation uses cached dependency layers. |
| 16 | `environment_does_not_leak_the_answer` | No issue identified | Starter contains infrastructure and incomplete shell only; new review/golden files are solely in solution/. |
| 17 | `solution_covers_every_deliverable` | No issue identified | 101 golden browser checks pass. The prior ZIP reproduced three in-flight draft-review failures; the revised golden fixes them and passes the dedicated four-check regression. |
| 18 | `solution_covers_every_graded_dimension` | No issue identified | Golden passes the new paused-member change-and-return and membership-only receipt-collision probes as well as the existing workflows. Other four verifiers are byte-identical. |
| 19 | `solution_honors_the_runtime_contract_and_is_self_contained` | No issue identified | Real solve.sh/runner starts unprivileged Node with embedded seed, durable DB and no runtime /assets dependency. |
| 20 | `solution_is_frozen_and_deterministic` | No issue identified | Checked-in reference code; no remote generation or runtime model dependency. |
| 21 | `verifier_entrypoint_is_safe_and_always_scores` | No issue identified | Unchanged zero-initialization/failure paths and safe lifecycle runner; 30 runner checks pass. |
| 22 | `verifier_image_can_launch_and_grade` | No issue identified | Pinned verifier runtime starts real browser/golden app and discovers all five judges; cached build limitation recorded. |
| 23 | `verifier_and_instruction_agree_on_the_runtime_contract` | No issue identified | Port, command, DB_PATH, SEED_PATH and health contract match the public brief. |
| 24 | `grading_wiring_is_structurally_correct` | No issue identified | TOML parses; five dimensions/86 criteria discovered; actual fixed 0.6/0.2/0.2 composition tested. |
| 25 | `judge_prompts_drive_the_browser` | No issue identified | All prompts drive real browser; added review requires visible UI and real exchanges, never source-only scoring. |
| 26 | `dimensions_cover_every_graded_requirement` | No issue identified | Fixed two concrete false-pass witnesses: validating only active roster revisions, and omitting roster revisions from round receipt identity. Both disposable mutants are detected. |
| 27 | `no_criterion_grades_the_unrequired` | No issue identified | Whole roster explicitly includes paused Members in instruction.md; round identity explicitly includes reviewed roster/revisions. No public requirement or criterion added. |
| 28 | `criteria_are_independent_and_noncontradictory` | No issue identified | Existing ownership split retained. Three roster conflict outcomes belong to one whole-roster correctness criterion; replay of their saved refusals belongs to the separate receipt owner. |
| 29 | `global_browser_gate_is_present_and_correct_in_every_dimension` | No issue identified | All five shared gates remain byte-identical, including real failed-login and credential-free protected-read probes. |
| 30 | `negative_checks_have_positive_controls` | No issue identified | Both new negative probes use real accepted round and membership UI controls, one changed input per collision packet, and before/after records. Eight deliberate round defects are detected. |
| 31 | `plural_asks_are_checked_across_all_matches` | No issue identified | Both active and paused Member change-and-return now have explicit observations. Target-only, ballot-revision-only and membership-revision-only receipt collisions are tested independently. |
| 32 | `criteria_are_outcome_based_and_browser_decidable` | No issue identified | Actual preview, confirmations, packets, protected records, audit, Member visibility and restart supply evidence; no route or schema is prescribed. |
| 33 | `criterion_description_is_self_consistent` | No issue identified | Each bar has one observable meaning; accepting a preflight or preventing an account switch are equivalent protections, not waived safety. |
| 34 | `interactive_time_varying_and_viewport_behavior_is_exercised` | No issue identified | 101 browser checks include held review save, Escape and a newer independent form; frozen-r26 reproduction proves the old late reply could close that form. The replacement preserves it. |
| 35 | `core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be` | No issue identified | Unchanged minimum-product gate and actual functional lifecycle/restart checks remain. |
| 36 | `grader_probes_are_not_pre_satisfied` | No issue identified | All round fixtures are freshly created through UI; no round outcome is pre-seeded or hardcoded. |
| 37 | `later_dimensions_tolerate_earlier_mutations` | No issue identified | 45 core checks then 19 round checks pass in one app process/database with no reset between suites. Leila revision-1 remains available for the boolean revision controls. |
| 38 | `batched_criteria_are_scored_independently` | No issue identified | Missing round feature ends affected cases only. Direct observed server receipts remain independently testable when recovery UI fails, and vice versa. |
| 39 | `floor_is_low_for_shells_mocks_and_stuffing` | No issue identified | Blank/auth fakes fail shared gate; real read-only/create-only/publish stubs still fail mandatory saved ballot journey. |
| 40 | `reward_is_graded_not_binary_and_discriminates` | No issue identified | 66 independently weighted binary functional outcomes plus graded visual craft preserve partial credit. |
| 41 | `binary_and_likert_fit_the_ask` | No issue identified | Behavior is binary; six visual properties retain five-point anchored Likert grades. |
| 42 | `reward_ranking_is_monotone` | No issue identified | All coefficients/weights positive; failing a behavior cannot increase score. Fake/read-only products are gated to zero. |
| 43 | `gates_apply_before_shaping_and_carry_no_reward_mass` | No issue identified | Render/Constraints have no final reward mass; their failure zeros all weighted terms. |
| 44 | `dimension_and_criterion_weights_are_honest` | No issue identified | Exactly the same criterion IDs, weights, dimension weights and gate formula as r26. Functional remains 103.5 total; 0.6 Functional + 0.2 Polish + 0.2 Visual after gates. |
| 45 | `judges_are_injection_resistant` | No issue identified | Untrusted app scoring instructions are ignored in all prompts; helper only records real observations. |
| 46 | `tests_and_key_are_out_of_agent_reach` | No issue identified | Tests/helpers remain private, outside /app; no grader code or answer copied into starter. |
| 47 | `verifier_is_deterministic_and_offline_pinned` | No issue identified | Same pinned model/runtime, temperature 0 and helpers; Functional prompt r27. Scripted execution and cached dependency builds cannot establish a fresh autonomous score. |
| 48 | `dimension_prompts_are_accurate_and_consistent` | No issue identified | One round success and four original round refusals (draft plus three roster races) are named consistently in criteria and Phase D. Other three ordinary domain refusals remain separate. |
| 49 | `cross_file_runtime_contract_is_consistent` | No issue identified | Source validator checks standard runtime/env/budget and single-authority weights; no parallel numeric policy changed. |
| 50 | `task_folder_holds_only_task_files` | No issue identified | 29 allowed files; exactly four differ from frozen r26. All validation scripts/evidence remain outside the upload. The previous ZIP hash is preserved. |
| 51 | `everything_parses_and_would_run` | No issue identified | All JSON/TOML parse; JavaScript executed by actual pinned browser and Node; runner/shell exercised. |
| 52 | `task_security_and_secrets` | No issue identified | Only public demo credentials; no live key in Dockerfiles/runner, no host paths in task, private capture redaction preserved. |
| 53 | `task_is_distinct_and_authored` | No issue identified | Association-specific anonymous ballots now include same-meeting opening against a reviewed roster; this is real product work, not a target-model exception. |

Remaining external validation: platform static/rubric review, an autonomous Oracle run and a fresh target-model run. No local provider credential is available. The final autonomous duration, including all 66 Functional verdicts, has not been measured. The old Functional run took 1929 seconds; the configured budget remains 7200 seconds with a 20-minute final-phase reserve.
