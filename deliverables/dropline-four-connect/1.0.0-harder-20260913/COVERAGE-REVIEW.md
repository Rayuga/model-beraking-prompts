# New-feature coverage review

This is an author-side alignment review, not a platform rubric verdict.
Existing gameplay coverage is preserved; rows below map the added contract.

| Added requirement | Graded observation |
| --- | --- |
| Fork named source prefix and reopen | analysis_fork_exact_prefix |
| Empty/final-step roots and valid names | analysis_rejections_are_atomic; analysis_draw_and_root_boundary |
| Sibling retention, selection and explicit Redo | analysis_sibling_paths_and_navigation |
| Nested relationships, rename and selected-cursor reload | analysis_nested_continuations |
| Win locking and competitive isolation | analysis_terminal_score_isolation |
| Draw/terminal roots and source-boundary Undo | analysis_draw_and_root_boundary |
| Both comparison boards, exact prefix, differences, symmetry and identical nodes | analysis_position_comparison |
| Ownership, foreign source/nodes and revoked tokens | analysis_ownership_boundaries |
| Stale revision, visible current state and new-ID recovery | analysis_stale_edit_and_recovery |
| Durable accepted/rejected receipts, mismatched IDs, pending repeat | analysis_operation_receipts; existing final restart |
| Strict invalid input and no partial state | analysis_rejections_are_atomic |
| Source survives archive undo/new competitive game | analysis_source_snapshot_independence |
| Both accounts' study/node/cursor/receipt restart persistence | existing restart_persistence_and_seed_idempotence |
| Actual route documentation, with local comparison allowed | existing runtime_manifest_routes |
| Labels, focus, mobile tree/comparison and reduced motion | existing Polish criteria extended to required new surfaces |
| Analysis keyboard operation and saved-feedback status | analysis_keyboard_actions_and_feedback |
| Appearance of all required study surfaces | six existing anchored Visual axes |

Fairness/order precautions:

- No API endpoint names or reference DOM selectors are prescribed to a model.
- Reads/comparison may share routes. Comparison itself may be local over
  server-loaded nodes; a dedicated comparison endpoint is not required.
- New game setup applies to competitive legs, not individual study actions.
- Initial seed check still runs before any competitive mutation. Other
  dimensions create only their own practice data, never overwrite a seed game.
- Fresh uniquely named studies and relative counts tolerate earlier analysis
  mutations. Source matching uses observed identity, not newest-entry guessing.
- Practice root cannot Undo before the source prefix; this is explicit in the
  brief rather than an incidental golden behavior.
- Final-step forks are viewable terminal roots; no forced winning continuation
  is demanded from them.
- Exact request retries return old responses but are assessed against a fresh
  read of current state; returning an old response is not mistaken for rollback.
- Pending-repeat evidence requires overlapping requests, not two separate
  completed intended moves. Controlled delays preserve real response content.
- A failed or unexecuted setup does not become a fabricated feature pass.
- Public assets remain permitted. Authentication/game/analysis storage stays
  local as explicitly required by the product brief.
- Existing Render/Constraints gates were not made harder to force lower scores.

Remaining risk: the task now has more real engineering and judge work. The
fixed standard timeouts are preserved, but only fresh platform evidence can
show whether the budgets and judge navigation are sufficient for this package.
