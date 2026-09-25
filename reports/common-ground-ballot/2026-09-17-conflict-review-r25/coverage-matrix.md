# Public requirement and criterion ownership

This is a local coverage review, not a platform QC verdict. Every Functional ID has an explicit public product requirement. Normal server guards, review UI, receipt outcomes and delivery ownership retain separate verdicts.

| Functional criterion | Public requirement | instruction.md line |
| --- | --- | --- |
| `authenticated_role_identity` | Identity, role and Observer workspaces | 9 |
| `seeded_ballot_and_roster_records` | Authoritative initial records | 25 |
| `observer_ballot_setup_access` | Identity, role and Observer workspaces | 9 |
| `observer_published_results_access` | Identity, role and Observer workspaces | 9 |
| `observer_members_access` | Identity, role and Observer workspaces | 9 |
| `observer_audit_access` | Identity, role and Observer workspaces | 9 |
| `ordinary_session_revocation` | Session authority, integrity and revocation | 69 |
| `all_sessions_revocation` | Session authority, integrity and revocation | 69 |
| `draft_input_validation` | Draft inputs and editing | 33 |
| `draft_creation` | Draft inputs and editing | 33 |
| `draft_edit` | Draft inputs and editing | 33 |
| `ballot_open_transition` | Lifecycle and delayed publication | 42 |
| `open_definition_lock` | Lifecycle and delayed publication | 42 |
| `fixed_eligibility_snapshot` | Eligibility frozen at opening | 51 |
| `staff_write_role_boundaries` | Identity, role and Observer workspaces | 9 |
| `session_identity_authority` | Session authority, integrity and revocation | 69 |
| `ballot_target_and_revision_validation` | Positive whole revisions; malformed writes leave records intact | 113 |
| `membership_input_validation` | Positive whole revisions; malformed writes leave records intact | 113 |
| `cross_ballot_choice_rejection` | Voting method and final submission limits | 33 |
| `single_choice_submission_limits` | Voting method and final submission limits | 33 |
| `private_final_vote_confirmation` | Private vote content and participation | 56 |
| `accepted_votes_preserve_ballot_revision` | Vote revision invariance | 77 |
| `exact_vote_success_receipt` | Exact durable operation receipts | 124 |
| `approval_order_independent_receipt` | Operation identity and Approval set equivalence | 133 |
| `operation_id_mismatch_safety` | Operation identity and Approval set equivalence | 133 |
| `approval_selection_limits` | Voting method and final submission limits | 33 |
| `duplicate_participation_rejection` | Voting method and final submission limits | 33 |
| `staff_identified_turnout` | Private vote content and participation | 56 |
| `anonymous_choice_separation` | Private vote content and participation | 56 |
| `member_participation_isolation` | Member read isolation | 63 |
| `ballot_close_transition` | Lifecycle and delayed publication | 42 |
| `closed_vote_refusal` | Lifecycle and delayed publication | 42 |
| `unpublished_results_hidden` | Lifecycle and delayed publication | 42 |
| `published_single_choice_tie` | Single-choice and Approval result mathematics | 42 |
| `publish_transition` | Lifecycle and delayed publication | 42 |
| `published_approval_tally` | Single-choice and Approval result mathematics | 42 |
| `stale_ballot_revision_refusal` | Ordinary optimistic concurrency | 85 |
| `published_terminal_lock` | Lifecycle and delayed publication | 42 |
| `business_audit_records` | Durable refusal receipts and private administrative audit | 143 |
| `audit_choice_privacy` | Durable refusal receipts and private administrative audit | 143 |
| `durable_reauthentication_and_seed_safety` | Durable state, sessions and one-time seed | 235 |
| `staff_mutation_success_receipts` | Exact durable operation receipts | 124 |
| `roster_conflict_snapshot_chain` | Ordinary optimistic concurrency | 85 |
| `refusal_receipt_after_state_change` | Durable refusal receipts and private administrative audit | 143 |
| `user_wide_operation_namespace` | Operation identity and Approval set equivalence | 133 |
| `durable_pending_staff_work` | Initial attempts survive before a reply; no automatic resend | 154 |
| `immutable_pending_retry` | Retry retains exact original attempt and resolves usable outcomes | 171 |
| `independent_pending_actions` | Several independently recoverable actions | 180 |
| `pending_actor_isolation` | Account-owned pending work across sign-in changes | 186 |
| `cross_tab_pending_resolution` | Shared pending state, late outcomes, closed owner recovery | 200 |
| `unforgeable_session_credentials` | Session authority, integrity and revocation | 69 |
| `disjoint_draft_review` | Combine disjoint or matching fields before explicit save | 99 |
| `conflicting_draft_review` | Compare three versions; explicitly choose each conflicting field | 92 |
| `draft_review_rechecks_revision` | Another edit during preview; retain working copy and re-review | 106 |
| `draft_review_discard` | Discard working copy without writing | 106 |
| `draft_review_lifecycle_stop` | Lifecycle locks stop reviewed editing | 106 |
| `late_recovery_reply_isolation` | Late Retry replies cannot affect the new account | 193 |

Render owns navigation and the minimum persisted create/open/vote/close/publish product gate. Constraints owns the documented health endpoint and real SQLite storage. Polish owns keyboard/semantic/focus/touch/motion/status/feedback/mobile operation. Visual owns degree of visual craft. Their four judge/prompt pairs are byte-identical to the last Oracle run, which scored each dimension 1.

All asked status surfaces are explicit in the brief: ballots, membership and participation. Review method/limit/ordered choices are one field, while title and context are independent. Matching concurrent changes receive no unnecessary conflict choice. The three new review workflows have distinct false-pass witnesses: lost remote fields, silently selected conflicts, or saving against an unseen revision. Discard and lifecycle stopping each have their own observable.

The reviewed-save refusal receipt is checked by refusal_receipt_after_state_change. draft_review_rechecks_revision scores only review working-copy retention, choosing the viewed revision and fresh operation IDs. This avoids scoring the same refusal body in two criteria. Existing read-only/mock floor controls remain mandatory Render/Constraints gates.

No evaluator-specific DOM selectors, route spellings, storage technology for pending/review state, or exact UI copy are imposed by the new criteria. Browser contexts and trusted helper APIs in the execution prompt describe evaluator tooling, not a required application implementation.
