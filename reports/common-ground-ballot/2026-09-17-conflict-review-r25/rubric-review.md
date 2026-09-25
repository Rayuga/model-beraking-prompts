# Local review against task-implementation.txt

Source SHA-256: `f1a9d70fb76ddcbd01b898da714582b0572b94543b597bf9b5d6482f84213da8`. Archetype: authenticated server-backed application with SQLite, private ballots, optimistic concurrency and browser recovery.

**This is a local author review, not a 53/53 platform result.** No new platform rubric run or autonomous scored Oracle/model run was available. Docker validation reused pinned cached dependency layers; it was not a clean external dependency-download build.

| # | QC criterion | Local finding | Basis |
| --- | --- | --- | --- |
| 1 | `instruction_is_a_natural_product_request` | No issue identified | First-person association product request; new review behavior explains the user problem without prescribing code. |
| 2 | `instruction_preserves_natural_human_voice` | No issue identified | Existing conversational voice retained; additions use concrete shared-tab and shared-computer situations. |
| 3 | `instruction_is_spelled_right_and_uncontaminated` | No issue identified | UTF-8 source and spelling reviewed; no template or evaluator residue in the brief. |
| 4 | `instruction_states_deliverables_and_runtime_contract` | No issue identified | Coverage matrix links all 57 Functional outcomes; runtime, accounts, statuses and presentation asks are explicit. |
| 5 | `instruction_leaks_no_grader_machinery` | No issue identified | No grader, score, rubric, criterion IDs or private verifier paths in instruction.md. |
| 6 | `instruction_is_achievable_and_unambiguous_in_the_environment` | No issue identified | New review requires one extra Draft and existing Ruth profiles; no new account/service/library or unavailable input. |
| 7 | `task_asks_for_a_real_working_product` | No issue identified | Full authenticated ballot product with real writes, private voting, durability and review/recovery workflows. |
| 8 | `task_identity_is_coherent` | No issue identified | Slug/name/version coherent; metadata updated to name draft review while keeping standard keys. |
| 9 | `agent_environment_and_network_posture_are_correct` | No issue identified | Public network, synthetic accounts and existing resource values preserved. |
| 10 | `verifier_is_isolated_pinned_and_credentialed` | No issue identified | Separate verifier, pinned packages/model wiring and unchanged verifier.env. |
| 11 | `timeouts_fit_the_work` | No issue identified | 12000s sum < 12600s runner < 13200s outer; Functional has 7200s, latest old run used 1929s; bounded new sequence reuses fixtures. |
| 12 | `no_prebuilt_image_shadows_the_agent_dockerfile` | No issue identified | No prebuilt agent image shadows environment/Dockerfile. |
| 13 | `assets_match_the_task` | No issue identified | Seed, starter and all public asset/runtime paths unchanged. |
| 14 | `seed_data_is_internally_consistent_and_clean` | No issue identified | Unchanged authoritative synthetic seed; old and new browser regressions accept it. |
| 15 | `dockerfile_builds_the_declared_world` | No issue identified | Agent Dockerfile/dependencies unchanged from the deployed working package; final local validation uses cached dependency layers. |
| 16 | `environment_does_not_leak_the_answer` | No issue identified | Starter contains infrastructure and incomplete shell only; new review/golden files are solely in solution/. |
| 17 | `solution_covers_every_deliverable` | No issue identified | 78 passing browser checks cover golden behavior; new review has saved server-backed positive controls. |
| 18 | `solution_covers_every_graded_dimension` | No issue identified | Every new outcome has a golden browser witness; all existing nonfunctional judges remain unchanged. |
| 19 | `solution_honors_the_runtime_contract_and_is_self_contained` | No issue identified | Real solve.sh/runner starts unprivileged Node with embedded seed, durable DB and no runtime /assets dependency. |
| 20 | `solution_is_frozen_and_deterministic` | No issue identified | Checked-in reference code; no remote generation or runtime model dependency. |
| 21 | `verifier_entrypoint_is_safe_and_always_scores` | No issue identified | Unchanged zero-initialization/failure paths and safe lifecycle runner; 30 runner checks pass. |
| 22 | `verifier_image_can_launch_and_grade` | No issue identified | Pinned verifier runtime starts real browser/golden app and discovers all five judges; cached build limitation recorded. |
| 23 | `verifier_and_instruction_agree_on_the_runtime_contract` | No issue identified | Port, command, DB_PATH, SEED_PATH and health contract match the public brief. |
| 24 | `grading_wiring_is_structurally_correct` | No issue identified | TOML parses; five dimensions/77 criteria discovered; actual fixed 0.6/0.2/0.2 composition tested. |
| 25 | `judge_prompts_drive_the_browser` | No issue identified | All prompts drive real browser; added review requires visible UI and real exchanges, never source-only scoring. |
| 26 | `dimensions_cover_every_graded_requirement` | No issue identified | Coverage matrix reconciles every Functional criterion; existing four dimensions retained; all new asks have owners. |
| 27 | `no_criterion_grades_the_unrequired` | No issue identified | Merge units, explicit choices, repeat review, discard, lock, late reply and abandoned tab are stated publicly. |
| 28 | `criteria_are_independent_and_noncontradictory` | No issue identified | Separate merge/choice/re-review/cancel/lock/delivery owners; receipt persistence stays in its existing criterion. |
| 29 | `global_browser_gate_is_present_and_correct_in_every_dimension` | No issue identified | All five shared gates remain byte-identical, including real failed-login and credential-free protected-read probes. |
| 30 | `negative_checks_have_positive_controls` | No issue identified | New refusals/absence checks use accepted edit/retry and authorized reads as positive controls. |
| 31 | `plural_asks_are_checked_across_all_matches` | No issue identified | All three merge fields and both late-response outcomes are required; existing all-role/action-family matrices retained. |
| 32 | `criteria_are_outcome_based_and_browser_decidable` | No issue identified | Full-credit observations are real UI, request/response and subsequent persisted records; no hardcoded app internals. |
| 33 | `criterion_description_is_self_consistent` | No issue identified | Each bar has one observable meaning; accepting a preflight or preventing an account switch are equivalent protections, not waived safety. |
| 34 | `interactive_time_varying_and_viewport_behavior_is_exercised` | No issue identified | Real clicks, tab creation/closure, held replies, reloads, restarts and 390px viewport were exercised. |
| 35 | `core_behavior_is_graded_and_state_is_proven_durable_where_it_must_be` | No issue identified | Unchanged minimum-product gate and actual functional lifecycle/restart checks remain. |
| 36 | `grader_probes_are_not_pre_satisfied` | No issue identified | Review values/records are newly created, distinct from seed data; none shipped pre-completed. |
| 37 | `later_dimensions_tolerate_earlier_mutations` | No issue identified | New review fixture is isolated after seeded checks; later dimensions explicitly use current mutated state. |
| 38 | `batched_criteria_are_scored_independently` | No issue identified | Failures stay with their owner; missing review ends only those unavailable UI cases and does not stop recovery tests. |
| 39 | `floor_is_low_for_shells_mocks_and_stuffing` | No issue identified | Blank/auth fakes fail shared gate; real read-only/create-only/publish stubs still fail mandatory saved ballot journey. |
| 40 | `reward_is_graded_not_binary_and_discriminates` | No issue identified | 57 independently weighted binary functional outcomes plus graded visual craft preserve partial credit. |
| 41 | `binary_and_likert_fit_the_ask` | No issue identified | Behavior is binary; six visual properties retain five-point anchored Likert grades. |
| 42 | `reward_ranking_is_monotone` | No issue identified | All coefficients/weights positive; failing a behavior cannot increase score. Fake/read-only products are gated to zero. |
| 43 | `gates_apply_before_shaping_and_carry_no_reward_mass` | No issue identified | Render/Constraints have no final reward mass; their failure zeros all weighted terms. |
| 44 | `dimension_and_criterion_weights_are_honest` | No issue identified | Functionality remains 60%; existing weights untouched. New workflow weights total 14/73.5, reflecting multi-step product work. |
| 45 | `judges_are_injection_resistant` | No issue identified | Untrusted app scoring instructions are ignored in all prompts; helper only records real observations. |
| 46 | `tests_and_key_are_out_of_agent_reach` | No issue identified | Tests/helpers remain private, outside /app; no grader code or answer copied into starter. |
| 47 | `verifier_is_deterministic_and_offline_pinned` | No issue identified | Pinned model/runtime, temperature 0 and prompt r25; acknowledge autonomous judge variance rather than claim determinism. |
| 48 | `dimension_prompts_are_accurate_and_consistent` | No issue identified | Shared accounts/seed/workspaces/paths consistent; reviewed-save refusal is the third saved refusal in Phase D, with one criterion owner. |
| 49 | `cross_file_runtime_contract_is_consistent` | No issue identified | Source validator checks standard runtime/env/budget and single-authority weights; no parallel numeric policy changed. |
| 50 | `task_folder_holds_only_task_files` | No issue identified | 29 allowed task files; reports, scripts, mutation fixtures and artifacts stay outside the ZIP. |
| 51 | `everything_parses_and_would_run` | No issue identified | All JSON/TOML parse; JavaScript executed by actual pinned browser and Node; runner/shell exercised. |
| 52 | `task_security_and_secrets` | No issue identified | Only public demo credentials; no live key in Dockerfiles/runner, no host paths in task, private capture redaction preserved. |
| 53 | `task_is_distinct_and_authored` | No issue identified | Association ballots, frozen eligibility, anonymous selections and revision-aware recovery/review form a domain-specific task. |

Concrete rejected witnesses: lost remote merge content; preselected conflicting fields; accepting an unseen revision; a discard control doing nothing; an enabled reviewed-save control after Open; old-account feedback in a new session. All six disposable mutations are detected. The previous GPT app also demonstrates lost stale working copy, unreadable acknowledgment loss, expired-session reminder loss, and a permanently busy reminder after its owning tab closes.

Required next external checks: upload this exact ZIP; obtain platform static/rubric result; run Oracle and the target GPT model on the same version. Local browser assertions do not prove autonomous completion of every verdict or a new model score.
