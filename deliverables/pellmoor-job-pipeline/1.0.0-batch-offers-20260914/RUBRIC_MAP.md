# Pellmoor rubric map

The executable rubric is in `tests/<dimension>/judge.toml`; this map is outside the task ZIP. All five prompt templates include the explicit shared browser/authentication gate, independent criterion scoring and public-asset policy. They retain the common judge configuration and the 60/20/20 final formula.

| Dimension | Criteria | Aggregation / purpose |
|---|---:|---|
| Render | 2 | All-pass local sign-in rendering and response smoke checks |
| Constraints | 2 | All-pass local entry, same-origin application and reload checks |
| Functional | 40 | Weighted mean of behavioral outcomes; total criterion weight 98 |
| Polish | 10 | Keyboard, focus, labels, mobile reachability and concrete interaction usability |
| Visual | 6 | Existing anchored typography, contrast, spacing, hierarchy, craft and responsive consistency |

## New Functional coverage

| ID | Weight | Independent outcome |
|---|---:|---|
| `batch_review_is_readonly_and_exact` | 1.5 | Selection/blocked/ready preview and cancellation are read-only and show exact assessment/capacity data. |
| `batch_commit_is_atomic_and_audit_linked` | 3.0 | One whole successful batch, one vacancy revision, exact applicant history and linked ordered audit. |
| `batch_invalid_member_and_capacity_reject_every_write` | 3.0 | One invalid member or aggregate overcapacity cannot leave partial product writes. |
| `batch_authorization_and_selection_contract` | 2.0 | Actor authorization, identifier shape/uniqueness/scope and server-owned field rejection. |
| `batch_stale_confirmation_requires_review` | 2.0 | Commit uses the reviewed revision; stale refusal requires explicit review and a new confirmation. |
| `batch_and_individual_races_commit_one_whole_operation` | 3.0 | Batch/individual and overlapping-batch races accept either whole winner, never a partial batch. |
| `batch_lost_response_recovers_original_operation_and_live_view` | 2.0 | Pending/lost response retains identity and input; explicit retry recovers the receipt and live view. |
| `batch_receipts_remain_historical_after_capacity_release` | 3.0 | Business rejection remains historical after capacity release; success replay, array mismatch and actor/session scoping. |

The original 32 Functional criterion IDs and weights are preserved. The existing post-restart receipt criterion now includes saved batch success/rejection receipts; the shared durable audit remains the only judge-authorized restart. Existing Render/Constraints criteria are not expanded into batch-completion gates.

The new weights allocate 3 points to commit integrity, invalid-batch atomicity, race arbitration and historical receipt semantics; 2 to authorization, reviewed confirmation and lost-response recovery; 1.5 to read-only preview fidelity. These represent distinct product outcomes. Existing failures are not duplicated or reweighted to force a target-model result. The 19.5 additional Functional points are not a guarantee of any model score.

## Measurement rules

Use the exact initial seed only before any mutations. Later tests use captured IDs, current revisions and relative snapshots. Create A/B/C/D through the visible UI; never assume generated ID values. Release capacity through legal actions, and obtain fresh scores after reopening interview. A preview does not authorize a stale commit. Take each transient checkpoint before another mutation.

For success, compare applicant-owned fields separately from derived vacancy revision/readiness, which legitimately change when capacity changes. For rejection/replay, require full product-state equality. Exclude the permitted durable rejection receipt and authentication session maintenance from product-state comparisons.

Race checks accept either legal winner and assert the exact consequences of that winner. Object-key order is immaterial; ordered candidate arrays are significant. Use fresh operation identities for new probes and exact saved identities for replay. Observe each applicant event ID; message presence alone cannot establish one-event semantics.

Polish and Visual use existing persisted records. Batch selection, preview and cancellation are allowed read-only preparation; committing offers is not. A blocked review is a valid presentation surface when no current selection can succeed. No dimension demands golden selectors, URLs, exact pixels or a fixed race winner.

## Full criterion inventory

### Render

- `public_page_loads` — weight 1.0
- `public_control_responds` — weight 1.0

### Constraints

- `same_origin_application_shell` — weight 1.0
- `self_contained_entry_and_reload` — weight 1.0

### Functional

- `authentication_sessions_and_revocation` — weight 1.0
- `seeded_pipeline_and_empty_vacancy` — weight 1.0
- `candidate_panel_score_note_fidelity` — weight 1.0
- `exact_derived_funnel` — weight 1.5
- `duplicate_rule_and_cross_vacancy_identity` — weight 1.0
- `role_enforcement_is_server_side` — weight 1.5
- `legal_stage_move_and_independent_applications` — weight 1.0
- `skip_and_large_backstep_are_atomic_rejections` — weight 1.0
- `terminal_candidates_are_locked_and_retained` — weight 1.0
- `score_boundaries_and_panel_ownership` — weight 1.5
- `offer_requires_a_complete_independent_panel` — weight 2.0
- `notes_are_attributed_append_only_activity` — weight 1.0
- `funnel_ripple_after_real_progress` — weight 1.5
- `candidate_views_and_activity_stay_coherent` — weight 1.0
- `stale_revision_rejects_then_allows_reviewed_retry` — weight 8.0
- `simultaneous_writes_commit_at_most_once` — weight 8.0
- `successful_retry_replays_one_result` — weight 8.0
- `rejected_retry_and_payload_mismatch_are_stable` — weight 8.0
- `malformed_or_identity_changing_writes_leave_product_state_exact` — weight 8.0
- `worded_action_and_error_feedback` — weight 1.0
- `pending_state_and_duplicate_prevention` — weight 1.0
- `runtime_manifest_routes` — weight 0.5
- `backstep_terminal_loss_attribution` — weight 0.5
- `panel_change_invalidates_entire_assessment` — weight 2.0
- `panel_removal_and_readdition_require_fresh_scores` — weight 2.0
- `reopened_assessment_and_frozen_stages` — weight 2.0
- `seeded_capacity_and_hired_offer_conversion` — weight 1.5
- `competing_offers_cannot_overbook` — weight 3.0
- `capacity_release_does_not_reexecute_old_receipts` — weight 2.5
- `receipt_identity_is_person_scoped_and_session_independent` — weight 2.0
- `batch_review_is_readonly_and_exact` — weight 1.5
- `batch_commit_is_atomic_and_audit_linked` — weight 3.0
- `batch_invalid_member_and_capacity_reject_every_write` — weight 3.0
- `batch_authorization_and_selection_contract` — weight 2.0
- `batch_stale_confirmation_requires_review` — weight 2.0
- `batch_and_individual_races_commit_one_whole_operation` — weight 3.0
- `batch_lost_response_recovers_original_operation_and_live_view` — weight 2.0
- `batch_receipts_remain_historical_after_capacity_release` — weight 3.0
- `durable_cross_role_audit_after_reload` — weight 1.5
- `success_and_rejection_receipts_survive_restart` — weight 2.0

### Polish

- `selected_vacancy_and_stage_hierarchy` — weight 1.0
- `candidate_surfaces_and_theme_state` — weight 1.0
- `mobile_has_no_page_overflow` — weight 1.0
- `mobile_pipeline_and_drawer_reachability` — weight 1.0
- `semantic_labels_and_landmarks` — weight 1.0
- `keyboard_workflow_and_focus` — weight 1.0
- `intentional_empty_states` — weight 1.0
- `drawer_reopen_preserves_context` — weight 1.0
- `reduced_motion_behavior` — weight 1.0
- `mobile_touch_targets_and_overlays` — weight 1.0

### Visual

- `visual_typography` — weight 1.0
- `visual_color_and_contrast` — weight 1.0
- `visual_spacing_and_layout` — weight 1.0
- `visual_hierarchy_and_scanability` — weight 1.0
- `visual_overall_craft` — weight 1.0
- `visual_responsive_consistency` — weight 1.0
