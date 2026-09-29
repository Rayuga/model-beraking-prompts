# Functional criterion dependency review

This review covers all 35 original Functional rows in `projects/colderwater-playground-devtools/tests/scored/functional/judge.toml`. The original IDs below preserve the audit mapping. The accepted minimal repair produces 37 rows by splitting the original Delete row into three; it also simplifies restart setup and clarifies Auto-run setup globally. This document records review decisions, not test results. No task source was edited and no tests were run to produce it.

An independent criterion needs its own evidence, but need not avoid every shared product capability. The suite explicitly gates ordinary authored execution and server-backed saving. A successful control before a forbidden operation, an exact saved-record read, or the operation whose variant is being tested can be essential setup. The parent review intentionally retains the other intrinsic workflows below. Optional finer divisions are not accepted bugs or requested edits.

## Accepted changes

- **Restart:** retain `cw_process_restart_durability` and its weight of 2.5. Create two independent records through New/Save, update before restart, record exact fields/revisions and the current library, perform one actual restart, then read exact state and update afterward while checking the sibling. Do not require Duplicate, Delete, confirmation, or Run. These unrelated features must not determine restart credit.
- **Delete:** replace the original `delete_confirm` weight of 3.0 with three independent rows, each weighted 1.0: `delete_confirm` for normal confirmation/cancellation, `cw_stale_delete_preserves_newer_record` for stale-delete refusal, and `cw_deleted_identity_rejects_update` for refusal to upsert a deleted identity. Each establishes its own dedicated records and meaningful successful controls. The two server-only rows do not depend on confirmation UI working or on the normal-confirmation row's verdict. Their controls establish the real operation and current state before the negative request.
- **Auto-run:** outside `auto_run`, disabling Auto-run is setup when available, not a separate pass condition. Missing or defective Auto-run alone must not cascade into unrelated failures or a failed basic Run gate. Judge each row's observed target behavior using valid setup; `auto_run` owns its dedicated on/off/debounce behavior. This clarification does not waive an actually observed failure of another row's target behavior.

## All original rows

| # | Original criterion ID | Dependency assessment and disposition |
| --- | --- | --- |
| 1 | `initial_examples` | **Keep.** Example selection, authored output, and an edited saved copy establish separation between built-ins and user records. Save/read controls are intrinsic to that distinction. |
| 2 | `language_dispatch` | **Keep.** Working JS/HTML and an installed immediate handler are necessary controls for CSS copying without script/handler inheritance and fresh JS globals. |
| 3 | `cw_completed_preview_interactions` | **Keep.** Its own HTML fixture establishes completed click/key/input behavior, completed-preview Stop, and recovery. No earlier interaction verdict is borrowed. |
| 4 | `fresh_cancel` | **Keep.** A successful preview, genuinely pending work, replacement/Stop, and recovery directly establish active-run cancellation and isolation. |
| 5 | `cw_preview_origin_isolation` | **Keep.** Legitimate own-document execution and fresh parent-state reads prevent a broken runner from earning a denial pass. |
| 6 | `cw_runtime_files_not_publicly_exposed` | **Keep.** Ordinary execution before/after probes of representative working-file paths establishes a healthy application. It does not require a separate file-inspection feature. |
| 7 | `cw_preview_network_requests_blocked` | **Keep.** Locally fulfilled fetch/image controls validate instrumentation; legitimate execution and separate authored probes establish the actual network boundary. |
| 8 | `cw_unsupported_execution_refusal` | **Keep.** Accepted text/comments/strings, five separate refusals, retained good output, and recovery distinguish unsupported execution from indiscriminate rejection. |
| 9 | `cw_execution_budget_termination` | **Keep.** Short successful control, two supported literal loops, visible termination, and recovery directly test the synchronous execution budget. |
| 10 | `cw_js_error_line_and_preview_restore` | **Keep.** Own successful JS control and later recovery are essential to exact line attribution and rollback of a failed JS candidate. |
| 11 | `cw_html_error_document_line_and_preview_restore` | **Keep.** HTML execution is inherent to complete-document line attribution; own good output and recovery establish rollback. |
| 12 | `cw_timer_error_line_and_preview_restore` | **Keep.** Timer execution, own good output, exact callback line, and recovery directly test asynchronous error rollback. |
| 13 | `cw_promise_rejection_line_and_preview_restore` | **Keep.** Promise rejection, own good output, source line, and recovery directly test unhandled-rejection rollback. |
| 14 | `console_levels` | **Keep.** Ordinary execution is gated; four emitted levels and their order/indicators are the behavior under test. No Clear prerequisite is added. |
| 15 | `console_objects` | **Keep.** Ordinary execution supplies the object/array evidence; app expansion controls are the direct target. No dependency on the level-row verdict. |
| 16 | `console_controls` | **Keep.** Appending rows, duration, both scroll states, and Clear are the selected console-control workflow. Retained rows are directly tested here. |
| 17 | `auto_run` | **Keep as owner.** Automatic execution, debounce reset, disabling, queued cancellation, and manual recovery are intrinsic legs. Global clarification prevents unrelated toggle penalties. |
| 18 | `pane_resize` | **Keep.** Both divider allocations and browser reload are direct controls for resizing and persistence. Any encountered dirty warning is handled as setup. |
| 19 | `editor_basics` | **Keep.** Source entry, per-language highlighting, line numbers, font, and matching braces do not require successful preview language dispatch. |
| 20 | `editor_indent` | **Keep.** Enter/select/Tab/Shift+Tab directly test indentation and exact source/selection preservation, without saving or running. |
| 21 | `save_load` | **Keep.** Two independent New/Save records, exact loads, stable identities, and browser reload directly establish basic durable saving. |
| 22 | `cw_process_restart_durability` | **Repair accepted.** Replace Duplicate/Delete/Run setup with two independent New/Save records, pre/post-restart updates, and exact reads. One actual restart remains essential. |
| 23 | `persistent_snippets` | **Keep.** Two live editors, a newer successful save, a real dirty draft, stale refusal, exact retained fields, and recovery are intrinsic conflict controls. |
| 24 | `cw_title_change_uniqueness` | **Keep.** Successful create/rename controls and current revisions isolate trimming, collision, empty-title, and case-distinction rules from stale-write rejection. |
| 25 | `cw_stale_rename_preserves_newer_record` | **Keep.** A real successful rename defines the operation; a newer revision and subsequent valid rename isolate stale-rename refusal and recovery. |
| 26 | `cw_independent_snippet_copy` | **Keep.** Own saved original, duplicate/edit/read, duplicate-name refusal, and a later successful copy directly establish independent copies and safe creation. |
| 27 | `delete_confirm` | **Split accepted: 3.0 to 1.0 + 1.0 + 1.0.** Normal confirmation/cancellation, stale-delete refusal, and deleted-identity upsert refusal get independent controls and verdicts. Server-only rows do not require confirmation. |
| 28 | `cw_dirty_workspace_transition_warnings` | **Keep.** Saved baseline plus four real replacement actions are intrinsic warning targets. Each re-establishes its own dirty state; title-only/filename-only edits remain explicit. |
| 29 | `cw_native_dirty_leave_warning` | **Keep.** Clean saved control, real keyboard interaction, cancelled native navigation, and accepted reload distinguish browser unload protection from custom dialogs. |
| 30 | `cw_exact_source_file_export` | **Keep.** Independent unsaved draft and actual download test exact export without requiring Save or Import. Apply the Auto-run setup clarification. |
| 31 | `cw_supported_source_file_import` | **Keep.** Import, execution, clean saved controls, exact reads, and current-revision invalid filenames form the chosen source-file workflow. Dirty warnings/export have other owners. |
| 32 | `cw_theme_switch_legibility` | **Keep.** Own working editor/preview/console state is necessary to prove theme changes preserve state. Contrast and aesthetic readability remain visual criteria. |
| 33 | `cw_keyboard_shortcut_actions` | **Keep.** Run, Save, and Clear are the documented keyboard action targets. Their actual effects are necessary evidence, not substituted button clicks. |
| 34 | `cw_shared_run_deadline_recovery` | **Keep.** Own successful baseline, four-second callback delay, callback loop, original-Run timing, and recovery directly establish a shared run deadline. |
| 35 | `cw_pending_interaction_budget_nonextension` | **Keep.** Own successful interaction commit establishes the latest good state; later pending work, another input attempt, timeout, rollback, and recovery test its interaction budget. |

## Optional future granularity, not defects or requested edits

An alternate rubric could separate startup/examples from saved-example separation, use equivalent JS fixtures for completed/pending interaction rows, or allocate successful-interaction commit/rollback to a different row. It could also divide console controls, shortcuts, import/filename validation, or individual dirty-transition actions more finely. These are choices about coverage and granularity; this review does not request them, classify the retained workflows as bugs, or authorize removing their evidence. In particular, dropping the preliminary committed interaction would weaken the current check that a later failure restores the latest successful interaction rather than the initial Run.

The accepted scope is the restart setup repair, the three-way Delete split, and the global Auto-run clarification. All other original workflows intentionally remain. Browser proofs, source validation, archive binding, and final criterion IDs/counts belong to the parent review's separate evidence.
