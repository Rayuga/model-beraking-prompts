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
| `ordinary_session_revocation` | Session authority, integrity and revocation | 109 |
| `all_sessions_revocation` | Session authority, integrity and revocation | 109 |
| `draft_input_validation` | Draft inputs and editing | 33 |
| `draft_creation` | Draft inputs and editing | 33 |
| `draft_edit` | Draft inputs and editing | 33 |
| `ballot_open_transition` | Lifecycle and delayed publication | 42 |
| `open_definition_lock` | Lifecycle and delayed publication | 42 |
| `fixed_eligibility_snapshot` | Eligibility frozen at opening | 51 |
| `staff_write_role_boundaries` | Identity, role and Observer workspaces | 9 |
| `session_identity_authority` | Session authority, integrity and revocation | 109 |
| `ballot_target_and_revision_validation` | Positive whole revisions; malformed writes leave records intact | 153 |
| `membership_input_validation` | Positive whole revisions; malformed writes leave records intact | 153 |
| `cross_ballot_choice_rejection` | Voting method and final submission limits | 33 |
| `single_choice_submission_limits` | Voting method and final submission limits | 33 |
| `private_final_vote_confirmation` | Private vote content and participation | 96 |
| `accepted_votes_preserve_ballot_revision` | Vote revision invariance | 117 |
| `exact_vote_success_receipt` | Exact durable operation receipts | 164 |
| `approval_order_independent_receipt` | Operation identity and Approval set equivalence | 173 |
| `operation_id_mismatch_safety` | Operation identity and Approval set equivalence | 173 |
| `approval_selection_limits` | Voting method and final submission limits | 33 |
| `duplicate_participation_rejection` | Voting method and final submission limits | 33 |
| `staff_identified_turnout` | Private vote content and participation | 96 |
| `anonymous_choice_separation` | Private vote content and participation | 96 |
| `member_participation_isolation` | Member read isolation | 103 |
| `ballot_close_transition` | Lifecycle and delayed publication | 42 |
| `closed_vote_refusal` | Lifecycle and delayed publication | 42 |
| `unpublished_results_hidden` | Lifecycle and delayed publication | 42 |
| `published_single_choice_tie` | Single-choice and Approval result mathematics | 42 |
| `publish_transition` | Lifecycle and delayed publication | 42 |
| `published_approval_tally` | Single-choice and Approval result mathematics | 42 |
| `stale_ballot_revision_refusal` | Ordinary optimistic concurrency | 125 |
| `published_terminal_lock` | Lifecycle and delayed publication | 42 |
| `business_audit_records` | Durable refusal receipts and private administrative audit | 183 |
| `audit_choice_privacy` | Durable refusal receipts and private administrative audit | 183 |
| `durable_reauthentication_and_seed_safety` | Durable state, sessions and one-time seed | 275 |
| `staff_mutation_success_receipts` | Exact durable operation receipts | 164 |
| `roster_conflict_snapshot_chain` | Ordinary optimistic concurrency | 125 |
| `refusal_receipt_after_state_change` | Durable refusal receipts and private administrative audit | 183 |
| `user_wide_operation_namespace` | Operation identity and Approval set equivalence | 173 |
| `durable_pending_staff_work` | Initial attempts survive before a reply; no automatic resend | 194 |
| `immutable_pending_retry` | Retry retains exact original attempt and resolves usable outcomes | 211 |
| `independent_pending_actions` | Several independently recoverable actions | 220 |
| `pending_actor_isolation` | Account-owned pending work across sign-in changes | 226 |
| `cross_tab_pending_resolution` | Shared pending state, late outcomes, closed owner recovery | 240 |
| `unforgeable_session_credentials` | Session authority, integrity and revocation | 109 |
| `disjoint_draft_review` | Combine disjoint or matching fields before explicit save | 139 |
| `conflicting_draft_review` | Compare three versions; explicitly choose each conflicting field | 132 |
| `draft_review_rechecks_revision` | Another edit during preview; retain working copy and re-review | 146 |
| `draft_review_discard` | Discard working copy without writing | 146 |
| `draft_review_lifecycle_stop` | Lifecycle locks stop reviewed editing | 146 |
| `late_recovery_reply_isolation` | Late Retry replies cannot affect the new account | 233 |
| `round_review_and_cancel` | Review a selected meeting round without writes | 56 |
| `round_atomic_open` | Commit every selected opening and fixed snapshot together | 62 |
| `round_draft_conflict` | Refuse any changed draft and explicitly review again | 62 |
| `round_roster_conflict` | Whole-roster revisions, including change-and-return | 70 |
| `round_input_boundaries` | Whole-round admissibility and required revision types | 76 |
| `round_role_boundaries` | Server-enforced Coordinator authority for rounds | 76 |
| `round_success_receipt` | Canonical round identity, namespace and original success | 82 |
| `round_refusal_receipts` | Original round refusals survive later confirmations | 85 |
| `round_pending_recovery` | One durable original pending round and current-state refresh | 90 |

Render owns navigation and the minimum persisted create/open/vote/close/publish product gate. Constraints owns the documented health endpoint and real SQLite storage. Polish owns keyboard/semantic/focus/touch/motion/status/feedback/mobile operation. Visual owns degree of visual craft. Their four judge/prompt pairs are byte-identical to the last Oracle run, which scored each dimension 1.

All asked status surfaces are explicit in the brief: ballots, membership and participation. Review method/limit/ordered choices are one field, while title and context are independent. Matching concurrent changes receive no unnecessary conflict choice. The three new review workflows have distinct false-pass witnesses: lost remote fields, silently selected conflicts, or saving against an unseen revision. Discard and lifecycle stopping each have their own observable.

The reviewed-save refusal receipt is checked by refusal_receipt_after_state_change. draft_review_rechecks_revision scores only review working-copy retention, choosing the viewed revision and fresh operation IDs. This avoids scoring the same refusal body in two criteria. Existing read-only/mock floor controls remain mandatory Render/Constraints gates.

No evaluator-specific DOM selectors, route spellings, storage technology for pending/review state, or exact UI copy are imposed by the new criteria. Browser contexts and trusted helper APIs in the execution prompt describe evaluator tooling, not a required application implementation.

r27 closes two false-pass witnesses inside existing owners. round_roster_conflict
now changes an initially paused Member to active and back to paused; checking
only active Members' revisions cannot pass. round_success_receipt separately
changes one roster revision under the original ID; omitting the roster from the
receipt fingerprint cannot pass. round_refusal_receipts reuses all four captured
draft/roster refusals. No hidden requirement or new score weight was introduced.
