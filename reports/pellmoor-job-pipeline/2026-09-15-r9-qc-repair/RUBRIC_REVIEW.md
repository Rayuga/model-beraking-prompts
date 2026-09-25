# Pellmoor r9 Functional rubric review

This repair aligns the Functional rubric with the supplied product requirements and gives more weight to a working hiring pipeline. It does not target any model score. The 40 criterion IDs, names and binary types, `weighted_mean` aggregation, Functional judge weight 0.6 and 9000-second timeout are unchanged.

Current judge: `projects/pellmoor-job-pipeline/tests/functional/judge.toml`, SHA256 `d8dc91d47de394e9ff2f2450e80aaf7a01730a84fc0fc47192216a6a08737c9e`.
Baseline: frozen r8 judge, SHA256 `f94fcc3ec76e6ad092599b167e7cab6c1fb1625afa29f557594df67c4476ca6f`.
The root packaging report will bind this audit to the final ZIP.

## Requirement alignment

- **panel refusal reason:** One applicable worded refusal is enough; no simultaneous-message or validation-order requirement. Eligibility, complete scores and eventual valid offer remain required. Source: `projects/pellmoor-job-pipeline/environment/instructions/hiring-rules.md:7-9`; `projects/pellmoor-job-pipeline/environment/instructions/interface.md:1-5`.
- **team metadata visibility:** Retain team seed metadata and verify it in authenticated data; no separate visible team label is required. Visible vacancy/candidate identities remain clear. Source: `projects/pellmoor-job-pipeline/instruction.md:3-6`; `projects/pellmoor-job-pipeline/environment/instructions/interface.md:1-5`.
- **manifest scope:** Require only the hosting note's listed route categories. Optional batch documentation is accepted; its omission is not a failure. Source: `projects/pellmoor-job-pipeline/environment/assets/recruitment/hosting-note.txt:32-35`.
- **chart element type:** Allow SVG, canvas or HTML-based chart elements; retain the required real chart, exact derived values and hosting note's D3 requirement. Source: `projects/pellmoor-job-pipeline/environment/assets/recruitment/hosting-note.txt:11-12`; `projects/pellmoor-job-pipeline/environment/instructions/hiring-rules.md:17-24`.
- **legacy conflict status:** Accept a 4xx stale conflict such as 409 or 412, with required explanation, current state and zero rejected writes. Explicit batch-stale and operation-mismatch 409 contracts remain unchanged. Source: `projects/pellmoor-job-pipeline/environment/instructions/reliability.md:5-9`; `projects/pellmoor-job-pipeline/environment/instructions/hiring-rules.md:60-66`; `projects/pellmoor-job-pipeline/environment/instructions/hiring-rules.md:97-113`.
- **revoked bearer status:** Accept an authentication refusal with no protected data; 401 and 403 are valid. Revocation, person scoping and independent sessions remain required. Source: `projects/pellmoor-job-pipeline/environment/instructions/security.md:1-5`; `projects/pellmoor-job-pipeline/environment/instructions/reliability.md:25-31`.
- **blocked projection convention:** Allow a clearly labeled hypothetical full-selection projection or unchanged projection explicitly explained as uncommittable. Current counts, block, read-only behavior and exact ready A,C projection remain required. Source: `projects/pellmoor-job-pipeline/environment/instructions/hiring-rules.md:70-77`; `projects/pellmoor-job-pipeline/environment/instructions/interface.md:29-37`.
- **clock implementation:** Require consistent chronology and correct actors, not golden timestamp values or clock implementation. Source: `projects/pellmoor-job-pipeline/environment/instructions/reliability.md:1-3`; `projects/pellmoor-job-pipeline/environment/instructions/hiring-rules.md:21-24`.
- **equivalent evidence collection:** Supplied helpers and filenames are optional; accept equivalent durable original evidence. Reuse precisely matching earlier notes, rejected requests and role actions, and chain verified unchanged snapshots across bounded independent probes. Preserve every required behavioral case, original first UI session, receipt, actor and comparison. Source: `TASK_TEMPLATE_STANDARD.md:163-181`; `projects/pellmoor-job-pipeline/environment/instructions/reliability.md:25-39`.
- **frozen stage coverage retained:** Required frozen-stage coverage retained. No otherwise-valid business probe is waived; only the already documented impossible-target case avoids prescribing duplicate/absent-member validation order. Source: `projects/pellmoor-job-pipeline/environment/instructions/hiring-rules.md:35-44`.

All explicitly required batch stale-409/mismatch-409 checks, assessment freshness, capacity arbitration, atomicity, durable retries and frozen-stage business checks remain. Optional capture tooling and reuse of exact existing evidence reduce judge work without awarding unobserved outcomes.

## Transparent weight changes

The raw total changes from **98 to 100**. The first 14 core criteria increase from **17/98 (17.35%) to 46/100 (46%)**. The five formerly 8-point legacy reliability criteria decrease from **40/98 (40.82%) to 12/100 (12%)**. The other advanced criteria retain positive weight and required coverage. This prioritizes creation, stage progression, panel/scoring/offer workflows, notes, derived funnels and durable records.

| Order | Criterion ID | Old weight | New weight |
| --- | --- | ---: | ---: |
| 1 | `authentication_sessions_and_revocation` | 1 | 2 |
| 2 | `seeded_pipeline_and_empty_vacancy` | 1 | 1 |
| 3 | `candidate_panel_score_note_fidelity` | 1 | 1 |
| 4 | `exact_derived_funnel` | 1.5 | 2 |
| 5 | `duplicate_rule_and_cross_vacancy_identity` | 1 | 5 |
| 6 | `role_enforcement_is_server_side` | 1.5 | 3 |
| 7 | `legal_stage_move_and_independent_applications` | 1 | 5 |
| 8 | `skip_and_large_backstep_are_atomic_rejections` | 1 | 4 |
| 9 | `terminal_candidates_are_locked_and_retained` | 1 | 2 |
| 10 | `score_boundaries_and_panel_ownership` | 1.5 | 5 |
| 11 | `offer_requires_a_complete_independent_panel` | 2 | 6 |
| 12 | `notes_are_attributed_append_only_activity` | 1 | 4 |
| 13 | `funnel_ripple_after_real_progress` | 1.5 | 4 |
| 14 | `candidate_views_and_activity_stay_coherent` | 1 | 2 |
| 15 | `stale_revision_rejects_then_allows_reviewed_retry` | 8 | 3 |
| 16 | `simultaneous_writes_commit_at_most_once` | 8 | 2 |
| 17 | `successful_retry_replays_one_result` | 8 | 2 |
| 18 | `rejected_retry_and_payload_mismatch_are_stable` | 8 | 2 |
| 19 | `malformed_or_identity_changing_writes_leave_product_state_exact` | 8 | 3 |
| 20 | `worded_action_and_error_feedback` | 1 | 1 |
| 21 | `pending_state_and_duplicate_prevention` | 1 | 1 |
| 22 | `runtime_manifest_routes` | 0.5 | 0.5 |
| 23 | `backstep_terminal_loss_attribution` | 0.5 | 1.5 |
| 24 | `panel_change_invalidates_entire_assessment` | 2 | 2 |
| 25 | `panel_removal_and_readdition_require_fresh_scores` | 2 | 2 |
| 26 | `reopened_assessment_and_frozen_stages` | 2 | 2 |
| 27 | `seeded_capacity_and_hired_offer_conversion` | 1.5 | 2 |
| 28 | `competing_offers_cannot_overbook` | 3 | 3 |
| 29 | `capacity_release_does_not_reexecute_old_receipts` | 2.5 | 2 |
| 30 | `receipt_identity_is_person_scoped_and_session_independent` | 2 | 2 |
| 31 | `batch_review_is_readonly_and_exact` | 1.5 | 2 |
| 32 | `batch_commit_is_atomic_and_audit_linked` | 3 | 3 |
| 33 | `batch_invalid_member_and_capacity_reject_every_write` | 3 | 2 |
| 34 | `batch_authorization_and_selection_contract` | 2 | 2 |
| 35 | `batch_stale_confirmation_requires_review` | 2 | 2 |
| 36 | `batch_and_individual_races_commit_one_whole_operation` | 3 | 2 |
| 37 | `batch_lost_response_recovers_original_operation_and_live_view` | 2 | 2 |
| 38 | `batch_receipts_remain_historical_after_capacity_release` | 3 | 2 |
| 39 | `durable_cross_role_audit_after_reload` | 1.5 | 4 |
| 40 | `success_and_rejection_receipts_survive_restart` | 2 | 2 |
| | **Total** | **98** | **100** |

## Synthetic policy examples

These are explicit score-policy examples, **not model rescoring, measured app results or a prediction of the next Oracle run**. All assume Render=Constraints=1. The read-only case fails the coordinated r9 persistent-note prerequisite in Polish and Visual; their scores are therefore 0 even if the screens look attractive. The plain application's P=0.6 and V=0.25 are illustrative partial scores.

| Example | Functional | Polish | Visual | Final reward |
| --- | ---: | ---: | ---: | ---: |
| authenticated read only shell | 0.065 | 0 | 0 | 0.039 |
| solid plain pipeline | 0.505 | 0.6 | 0.25 | 0.473 |
| fully working polished application | 1 | 1 | 1 | 1 |

Functional pass sets, using the order/IDs in the complete table above:

- Read-only shell: criteria **1, 2, 3, 4, 22** only.
- Solid plain pipeline: criteria **1–14, 22, 39** only.
- Fully working polished application: **all 40**.

Every Functional criterion outside each listed pass set scores 0. The JSON report records the explicit IDs rather than relying only on order.

Under the previous weights and no persistent-note prerequisite for P/V, the same hypothetical attractive read-only pass set with P=V=1 scores **0.430612**, while the plain pipeline scores **0.286327**. The revised policy gives **0.039** and **0.473**, respectively. This demonstrates the corrected ordering for the stated examples; it does not establish a universal ranking across all tradeoffs.

For fixed gates, `F = sum(weight * criterion) / 100`. Every criterion has positive weight, so improving any individual result while holding the others fixed increases the final reward by `0.6 * weight / 100` times that improvement. The final formula remains `0.6*F + 0.2*P + 0.2*V` after the existing Render/Constraints gates.

## Validation and limits

The final TOML parses; all 40 identities/types and the judge configuration remain unchanged; all weights are positive and sum to 100. This report covers the Functional judge only. Root's actual MCP tests for the P/V prerequisite and its 11 RewardKit compatibility tests are separate evidence and must not be presented as a hosted QC or Oracle pass. The source and frozen r8 evidence were not rescored.

