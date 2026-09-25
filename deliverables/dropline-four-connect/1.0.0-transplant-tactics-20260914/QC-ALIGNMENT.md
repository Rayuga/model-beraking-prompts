# New-feature requirement / verification alignment

This is a manual review against `WebDev Rubrics QC.xlsx` and the current shared template, plus the recorded local tests. It is not a claim that the platform's 53 rubric checks were executed or passed.

| Stated behavior in `study-tools.md` | Primary graded evidence |
|---|---|
| Replay source columns at new destination; exact positions and zero preview mutation | `transplant_preview_rederived_positions` |
| One atomic destination increment and complete mapping, originals/cursors unchanged | `transplant_atomic_commit_mapping` |
| Recursively reuse identities, retain unrelated branches, increment even if all reused | `transplant_recursive_merge_identity` |
| Finite frozen source when copying within/below itself | `transplant_same_study_frozen_subtree` |
| First invalid path in depth-first ascending order, full-column/terminal rejection, no partial tree | `transplant_illegal_descendant_rollback` |
| Both revisions checked, conflict leaves state intact, re-preview recovery | `transplant_dual_revision_conflicts` |
| Exact successful/rejected retry, conflicting payload, consumed-preview rejection | `transplant_durable_receipts` |
| Ownership, invalid source/root/node/extra fields and commit identifiers | `transplant_private_validation` |
| Terminal evaluated before horizon, unknown not draw, shortest proven win | `tactics_immediate_and_horizon` |
| Universal opponent replies, three-ply forced fork | `tactics_forced_fork_search` |
| Required defence, correct player perspective, longest forced-loss resistance | `tactics_opponent_defence_and_loss` |
| Full-column exclusion, final draw move, terminal root has no recommendations | `tactics_full_columns_and_terminal_draw` |
| Every bounded reply/path, no merging equal boards, visible exact-position inspection | `tactics_complete_bounded_proof` |
| Repeated/reloaded deterministic report, no saved mutation, stale report invalidation | `tactics_readonly_repeatability` |
| Server computation on authenticated saved nodes and malformed depth/extra-field rejection | `tactics_server_input_boundaries` |
| Persist preview, accepted/rejected receipts and unchanged proof across process restart | Existing `restart_persistence_and_seed_idempotence`, extended within the same two restarts |
| Describe actual tool routes in manifest | Existing `runtime_manifest_routes`, extended |
| New controls named/focusable, responsive and reduced-motion usable | Existing Polish label/layout/motion criteria, extended scope |
| Preview/commit pending guard and announced post-action feedback/focus | `transplant_control_feedback` |
| Keyboard explanation disclosure/inspection and announced feedback | `tactical_proof_keyboard_inspection` |
| Cohesive legible tool panels and proof/board layout at both sizes | Existing six Visual axes; prompt includes populated new surfaces |
| Separately intended same-name studies are independent (existing analysis brief) | `independent_same_name_analyses` |

## Avoiding previous failure patterns

- New requirements are in the delivered agent-readable file and linked from the task. No inaccessible authoring notes define graded behavior.
- Fixtures are created through visible controls. Server rejection/retry probes adapt observed requests; they do not require golden route names or fabricated state.
- Negative paths have working positive controls. Both valid preview/commit and valid tactical reports are exercised before testing rejections.
- Complete collections are checked where required: every copied node mapping, every ordered legal reply, all 2,801 empty-root depth-four proof nodes. Browser inspection includes a concrete non-root four-ply path.
- Relative destination paths are explicitly distinguished from full saved move history. Replayed colors and gravity derive from the destination, avoiding ambiguity.
- Definitions specify player perspective, distance, terminal/horizon precedence, shortest win and longest loss. An independently written reference confirmed the numeric expectations.
- Criteria test bounded behaviors, not an aesthetic all-or-nothing bundle. New Polish action lifecycle checks are separate from static labels. Visual remains anchored Likert and does not award separate tactical functionality points.
- Independent studies and account-specific setup avoid cross-dimension contamination. The final restart is ordered after new mutations, and the deliberate post-restart preview commit follows unchanged-snapshot observations.
- Existing gates, API/runtime requirements, original criteria weights, public networking and shared 60/20/20 formula remain. The new features are not additional hard-zero gates.
- Judge/browser errors must be distinguished from app defects. Held-response duplicate checks and independent login responses are explicitly described.

## Limits

Static template validation passed locally; subjective rubric assessment and the full LLM/browser journey require the platform. The 43 Functional checks are a larger journey under the unchanged standard timeout. Fresh image builds were network-blocked locally. These limits are retained in the handover rather than represented as passes.
