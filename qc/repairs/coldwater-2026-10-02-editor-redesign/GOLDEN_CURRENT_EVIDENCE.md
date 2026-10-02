# Colderwater Golden evidence — current candidate

Date: 2026-10-02

This report covers the current built Golden solution after the custom-editor Escape/Tab focus fix. The app was installed from a clean solution copy, served from `/app`, and exercised with Chromium against the running application. Persistence was also checked across an actual Node server-process restart while retaining the same SQLite database.

## Criterion count

| Dimension | Criteria |
| --- | ---: |
| Render gate | 1 |
| Constraints gate | 2 |
| Functional | 23 |
| Polish | 2 |
| Visual | 3 |
| **Total** | **31** |

## Current Golden result

| Criterion | Local result | Evidence |
| --- | --- | --- |
| `cw_authored_custom_editor_run` | Pass | `golden-runtime-matrix.cjs` |
| `cw_custom_document_surface` | Pass | `clean-golden-smoke.cjs` confirms a custom non-editable `DIV` surface and no CodeMirror |
| `cw_shared_saved_record` | Pass | `golden-persistence-before.cjs` exercises two browser roles against the shared server record |
| `cw_custom_typing_and_line_join` | Pass | `golden-editor-matrix.cjs` |
| `cw_caret_navigation_and_line_numbers` | Pass | `golden-editor-matrix.cjs` |
| `cw_grapheme_navigation_and_deletion` | Pass | `clean-editor-deep.cjs` |
| `cw_mouse_selection` | Pass | `clean-selection-flows.cjs` |
| `cw_block_indent_undo` | Pass | `clean-editor-deep.cjs` |
| `cw_multi_caret_typing_atomic` | Pass | `clean-editor-flows.cjs` |
| `cw_multi_caret_delete` | Pass | `clean-multicaret-delete.cjs` |
| `cw_find_forward_backward_wrap` | Pass | `golden-editor-matrix.cjs` |
| `cw_replace_current` | Pass | `clean-editor-state.cjs` |
| `cw_replace_all_atomic` | Pass | `clean-editor-state.cjs` |
| `cw_js_semantic_coloring` | Pass | `clean-editor-state.cjs` and `clean-format-color.cjs` |
| `cw_html_semantic_coloring` | Pass | `clean-editor-flows.cjs` |
| `cw_js_format_semantics_and_undo` | Pass | `golden-editor-matrix.cjs` and `clean-format-color.cjs` |
| `cw_html_format_semantics_and_undo` | Pass | `golden-editor-matrix.cjs` and `clean-editor-flows.cjs` |
| `cw_long_line_editing` | Pass | `clean-editor-deep.cjs` |
| `cw_html_preview` | Pass | `clean-editor-flows.cjs` |
| `cw_error_message_and_line` | Pass | `clean-runtime-flows.cjs` |
| `cw_last_good_recovery` | Pass | `golden-runtime-matrix.cjs` |
| `cw_timeout_stop_and_supersession` | Pass | `golden-runtime-matrix.cjs` |
| `cw_preview_boundary` | Pass | `golden-runtime-matrix.cjs` and `clean-boundary-format.cjs` |
| `cw_save_reload_restart` | Pass | `golden-persistence-before.cjs`, process restart, then `golden-persistence-after.cjs` |
| `cw_stale_save_draft_safety` | Pass | `golden-persistence-before.cjs` |
| `cw_history_restore_retry` | Pass | `golden-persistence-before.cjs` |
| `cw_controls_keyboard_and_focus` | Pass | `golden-polish-visual.cjs`; keyboard traversal includes leaving the editor and reaching library/history |
| `cw_controls_feedback_and_labels` | Pass | `golden-polish-visual.cjs` |
| `cw_visual_editor_readability` | Locally inspected | Current 1440×900 screenshot; readable syntax colors, aligned line numbers and clear caret |
| `cw_visual_workspace_layout` | Locally inspected | Current screenshot and geometry assertion show no pane overlap |
| `cw_visual_component_finish` | Locally inspected | Current screenshot shows a coherent, finished visual system |

All 28 binary criteria passed the current local behavioral checks. The three visual criteria were inspected against `cw-golden-current.png`; their final scores remain judge decisions.

## Configured Oracle limitation

The configured full verifier was attempted, but its judge process exited before grading with `claude-code:unrecognized_model` for `z-ai/glm-5.3-flashx`. A direct provider probe also returned HTTP 401. Therefore this run produced no valid Oracle measurement. The local evidence supports the Golden implementation, but it does not prove a portal Oracle score of 1.
