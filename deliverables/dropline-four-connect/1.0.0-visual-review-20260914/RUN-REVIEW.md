# Dropline platform run review — September 14, 2026

These are supplied platform results for the pre-visual-repair task, not new runs. All five verifier prompt/judge hashes match current source.

| Model | Functional | Polish | Visual | Overall |
|---|---:|---:|---:|---:|
| oracle | 1.0000 | 1.0000 | 0.7917 | 0.9583 |
| nop | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| gemini-3.7-flash | 0.9012 | 0.6250 | 0.8750 | 0.8407 |
| claude-haiku-4-5 | 0.0741 | 0.1250 | 0.8333 | 0.2361 |
| gpt-5.4-mini | 0.7531 | 0.7500 | 0.9583 | 0.7935 |

All completed model/Oracle trials passed Render and Constraints. No-op scored zero. No trial-level exception was reported.

## Findings and interpretation

Oracle passed every Functional and Polish criterion. Its five Visual deductions were typography (long names/narrow history), disconnected dark/light palettes, uneven spacing, archive/replay hierarchy, and inconsistent components. Responsive Visual received full credit. The low overall result is not a game-rule failure.

GPT passed 21 of 27 Functional criteria, including seed import, archive/replay, gravity, every win/draw direction, terminal lock, undo/redo, account restoration, frozen analysis prefixes, nested branches, practice-score isolation, exact comparison, ownership, stale-analysis recovery, source independence, manifest and restart persistence. Its six reported failures and all other models’ deductions appear below.

Local reproduction on the UNMODIFIED exported GPT artifact disputes three deductions: separately submitted login forms issue distinct bearer tokens; game moves and analysis moves each issue exactly one request while the first real response is held and a second physical pointer activation is attempted. The published score is unchanged. Source also contains the corresponding fresh-token generation and pending guards. These checks do not regrade every other checkpoint in the affected criteria, and the native judge action trace was not exported. See gpt-fairness.json and gpt-fairness.cjs.

Genuine GPT defects reproduced locally: focus returns to BODY after a game activation; a numeric-string analysis revision is accepted; a separate fresh creation using the same source/name returns the existing analysis instead of creating a distinct one. The last defect violates the existing brief but is not specifically exposed by the current test journey. The broken child selector is supported by the exported code: child IDs are treated as node objects, producing undefined option labels/values. Analysis focus loss follows the same rerendering pattern and was reported by the judge.

Gemini passed 24 of 27 Functional criteria. Its focus and extra-field rejection findings have specific evidence. The restart deduction explicitly says the Redo-between-restarts checkpoint was not completed; that is missing verification, not demonstrated data loss. Haiku passed only 3 of 27 Functional criteria: its first game mutation triggered client/server errors, so most downstream scenarios were unreachable. Its low score is not 24 independent bugs.

## Difficulty recommendation

Do not rerun the unchanged task hoping for a lucky sub-0.70 score. GPT and Gemini both implemented most of the substantial branching feature. Correcting questionable judging would tend to raise GPT’s score, not lower it. Keep the standard 60/20/20 formula and do not inflate weights on whichever checks happened to fail.

A small coverage improvement is to check distinct same-name analyses, equal-board/different-path comparisons, and interleaved edits to two independent studies. These are existing requirements and can expose real defects, but are unlikely on their own to reliably move GPT below 0.70.

For a substantial new challenge, recommend an atomic variation-editing workflow: preview and transplant a selected subtree onto another position; replay every edge under gravity/turn/terminal rules; reuse shared legal edges; reject the whole operation when a descendant becomes illegal; preserve originals and map old nodes to resulting nodes; commit with per-study revision checks and durable retry receipts. Complement this with multi-line import that shares prefixes and rolls back the entire batch on one invalid line. These are useful study features, not hidden traps. They need an explicit product brief, independent bounded criteria, golden implementation, local tests and fresh QC/Oracle. They have NOT been implemented in this visual-only package; confirm scope before that expansion. No predicted model score is claimed.

## All reported deductions

### oracle — run-066a2688-cfa9-4ca5-9776-70d7811110cb

- `visual/visual_typography` (0.75, weight 1.0): Clear typographic tiers distinguish branding, account, turn state, totals, history, replay, and analysis. Most text is readable and aligned; long analysis names and some narrow history labels truncate or wrap awkwardly.
- `visual/visual_color_and_contrast` (0.75, weight 1.0): Dark game/replay surfaces use a cohesive blue board with clearly distinct red, yellow, and empty cells, plus readable text and accents. The light analysis workspace is highly legible but slightly disconnected from the dark game theme.
- `visual/visual_spacing_and_layout` (0.75, weight 1.0): Sign-in, board controls, cards, replay, tree, and comparison controls have consistent gutters and deliberate grouping. The narrow history column wraps content and the long desktop sidebar creates some excessive blank space beside lower sections.
- `visual/visual_hierarchy_and_scanability` (0.75, weight 1.0): The active board and turn state are prominent, with totals and history grouped beside it; archived matches and replay are clearly separated. Analysis provides a readable sequence from status to board, tree, selected history, and comparison, though the long archive pushes replay lower.
- `visual/visual_overall_craft` (0.75, weight 1.0): A considered board-game visual system carries through sign-in, active game, history, replay, analysis tree, and comparison. The finished treatment is strong, with minor inconsistencies from the light analysis card, native-looking selects, and clipped long names.

### nop — run-066a2688-cfa9-4ca5-9776-70d7811110cb


### gemini-3.7-flash — run-5e6f2a7e-f0ca-4bfd-8ae0-0e4d00e39619

- `functional/keyboard_focus_and_activation` (0.0, weight 2.0): Keyboard navigation and Enter/Space activation worked, but after keyboard Redo the active element was BODY rather than the column-2 control, so usable focus was not preserved.
- `functional/analysis_rejections_are_atomic` (0.0, weight 1.0): Invalid name and source-step probes rejected, but creation requests carrying extra board and account fields incorrectly returned 201 and created two studies, violating the required atomic 4xx behavior.
- `functional/restart_persistence_and_seed_idempotence` (0.0, weight 1.0): Both helper restarts preserved the captured Avery revision-229 game/archive and full study snapshots, and the recorded analysis receipt replay returned its original 200. However, the required Redo-after-first-restart followed by a second restart of that post-Redo state was not completed, so post-Redo restart persistence is unverified.
- `polish/responsive_layout_and_feedback` (0.0, weight 0.5): Sign-in, game, replay, and analysis surfaces fit at 375px without horizontal overflow, but the completed-match list visibly overlaps the Match Totals and Current Round History cards.
- `polish/analysis_keyboard_actions_and_feedback` (0.0, weight 1.0): Column navigation, keyboard drops, Undo, tree navigation, selector changes, and comparison worked with announced/visible state updates, but after keyboard Redo became unavailable focus fell to the body instead of a useful enabled control.
- `visual/visual_typography` (0.75, weight 1.0): Clear type scale distinguishes branding, account identity, turn state, totals, results, and history across sign-in, game, replay, and analysis. Minor unfinished text artifacts such as “#undefined” history labels and literal “&bull;” remain.
- `visual/visual_spacing_and_layout` (0.75, weight 1.0): Consistent gutters and deliberate grouping of boards, controls, totals, history, replay, and comparison panels. A few long surfaces require scrolling and some mobile headings/buttons wrap.
- `visual/visual_overall_craft` (0.75, weight 1.0): Strong unified component language with rounded panels, polished boards, focused modal treatment, variation tree, and comparison diff states. Literal entity text and undefined history numbering prevent a fully finished score.

### claude-haiku-4-5 — run-9944d078-589e-4f72-bc25-fd52ab0332e9

- `functional/seeded_state_import_and_isolation` (0.0, weight 2.0): Avery’s seeded board/totals/revision matched, but Redo was disabled instead of available and Avery later displayed Jordan’s archive.
- `functional/completed_match_archive_and_replay` (0.0, weight 3.0): After New Game, the first move returned winningCells:null and caused a client TypeError; the next move returned HTTP 500.
- `functional/authenticated_account_workflow` (0.0, weight 1.0): Authentication and bearer-token reads passed, but the required New Game/drop/sign-out/restore workflow failed on game mutation.
- `functional/gravity_turns_and_full_column` (0.0, weight 1.0): Required multi-move setup was unreachable because game moves failed.
- `functional/horizontal_and_vertical_wins` (0.0, weight 1.0): Required winning sequences could not be played.
- `functional/both_diagonal_wins` (0.0, weight 1.0): Required winning sequences could not be played.
- `functional/yellow_win_and_terminal_lock` (0.0, weight 1.0): Required winning sequence could not be played.
- `functional/exact_draw_and_terminal_lock` (0.0, weight 1.0): Required 42-move sequence could not be played.
- `functional/move_history_undo_redo_branching` (0.0, weight 2.0): Required branching setup could not be reached.
- `functional/new_game_reset_and_persistence` (0.0, weight 1.0): New Game returned an empty state, but subsequent visible moves failed with client/server errors.
- `functional/keyboard_focus_and_activation` (0.0, weight 2.0): Keyboard focus navigation worked, but activation failed before the required two-move checks.
- `functional/multi_tab_revision_and_duplicate_guard` (0.0, weight 2.0): Separate tabs/tokens worked, but the required accepted multi-move stale-tab sequence was unreachable.
- `functional/accessible_grid_and_winning_names` (0.0, weight 1.0): The 42-cell coordinate/occupant naming passed, but no required winning position could be created.
- `functional/analysis_fork_exact_prefix` (0.0, weight 2.0): No Avery Red source could be created.
- `functional/analysis_sibling_paths_and_navigation` (0.0, weight 2.0): No Avery Red-source analysis was available.
- `functional/analysis_nested_continuations` (0.0, weight 1.5): No Avery Red-source analysis was available.
- `functional/analysis_terminal_score_isolation` (0.0, weight 2.0): No Avery Red-source analysis was available.
- `functional/analysis_position_comparison` (0.0, weight 2.0): The required Avery Red-source analysis was unavailable.
- `functional/analysis_ownership_boundaries` (0.0, weight 2.0): No two Avery studies existed for the required ownership probes.
- `functional/analysis_stale_edit_and_recovery` (0.0, weight 2.0): No Avery Red-source study existed.
- `functional/analysis_operation_receipts` (0.0, weight 2.0): No Avery Red-source study existed.
- `functional/analysis_rejections_are_atomic` (0.0, weight 1.0): The required fresh Avery step-0 source setup was unavailable.
- `functional/analysis_source_snapshot_independence` (0.0, weight 1.0): The required Avery competitive Red source and fork were not created.
- `functional/restart_persistence_and_seed_idempotence` (0.0, weight 1.0): Two restarts preserved observed state, but the required three-move Avery setup was not reached and the recorded analysis replay returned 409 instead of its original response.
- `polish/archive_replay_usability` (0.0, weight 1.0): Replay has 42 named cells and keyboard step controls, but the replay surface does not identify the match result; Previous/Next also remain enabled at endpoints.
- `polish/responsive_layout_and_feedback` (0.0, weight 0.5): At 375px the game sidebar is hidden, so totals, history, Undo/Redo, New Game, archive, and revision are unreachable; replay Next is clipped.
- `polish/control_labels_and_focus` (0.0, weight 1.0): Most controls are named and focusable, but clickable variation-tree nodes are generic, not keyboard-focusable controls.
- `polish/analysis_keyboard_actions_and_feedback` (0.0, weight 1.0): Analysis column Left/End/Home/Right navigation fails; Enter/Space routed to competitive game moves, and Undo/Redo rerenders lose focus despite an announced status region.
- `visual/visual_spacing_and_layout` (0.75, weight 1.0): Sign-in, replay, and analysis use consistent padding and board/control grouping. Minor imbalance comes from the compact left-aligned desktop game shell and tighter narrow-screen rows.
- `visual/visual_overall_craft` (0.75, weight 1.0): Consistent cards, buttons, board geometry, overlays, and history treatments create a coherent product language, though the presentation remains somewhat utilitarian and secondary panels are sparse on narrow screens.
- `visual/visual_responsive_consistency` (0.5, weight 1.0): Sign-in scales cleanly and replay/analysis stack coherently, but the 375px game view removes the sidebar and the long analysis title and comparison stack noticeably reduce secondary hierarchy.

### gpt-5.4-mini — run-b7bf6968-32c6-4dba-9a70-2b102dfabd9b

- `functional/keyboard_focus_and_activation` (0.0, weight 2.0): Activation worked but focus was lost instead of remaining on column 2.
- `functional/multi_tab_revision_and_duplicate_guard` (0.0, weight 2.0): Cross-tab conflict/idempotency passed, but rapid duplicate activation produced duplicate accepted moves.
- `functional/cross_tab_sign_out_revocation` (0.0, weight 1.0): Revocation passed, but separately signed-in tabs did not receive distinct bearer tokens as required.
- `functional/analysis_sibling_paths_and_navigation` (0.0, weight 2.0): Sibling branches passed, but the redo-choice control exposed undefined values/labels and could not reliably choose a child.
- `functional/analysis_operation_receipts` (0.0, weight 2.0): Exact creation/move replays and conflict/reuse checks passed, but rapid pending repeat created two accepted moves.
- `functional/analysis_rejections_are_atomic` (0.0, weight 1.0): Invalid creates were rejected, but string expectedRevision "0" was accepted and advanced the study.
- `polish/analysis_keyboard_actions_and_feedback` (0.0, weight 1.0): Column navigation worked, but Enter dropped once and focus returned to BODY, so Space did not perform the second drop. Analysis Undo/Redo also returned focus to BODY after completion despite live saved feedback.
- `visual/visual_spacing_and_layout` (0.75, weight 1.0): Cards, boards, history, tree, and comparison are well grouped with consistent gutters; minor unevenness remains in the mobile seven-button rows and replay slider spacing.
