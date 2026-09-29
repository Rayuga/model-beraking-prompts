"""Build review-only atomic rubric drafts. Never writes into the task tree."""
from pathlib import Path
from decimal import Decimal
import hashlib
import json
import re
import tomllib

out = Path(__file__).resolve().parent
root = out.parents[3]
task = root / 'deliverables/colderwater-playground-devtools/two-findings-fix-2026-09-27/archive-check-5d0f1d74ae48/colderwater-playground-devtools'
source = (task / 'tests/scored/functional/judge.toml').read_text(encoding='utf-8')
original = tomllib.loads(source)
draft = out / 'draft'
draft.mkdir(parents=True, exist_ok=True)

# Each row is evidence-key | exact Decimal weight | its exclusively owned result.
plans = {
'initial_examples': '''
startup_source|0.05|The fresh workspace contains useful editable source without first choosing or creating a snippet.
startup_preview|0.10|Opening the fresh workspace automatically produces the starting source's preview without pressing Run.
startup_console|0.05|Opening the fresh workspace automatically produces console feedback from the starting source without pressing Run.
example_editable|0.05|A selected built-in example loads source that can actually be edited; confirm the entered authored replacement in the real editor.
example_output|0.10|The chosen built-in example produces working output when run, whether selection starts it or the user presses Run.
example_separate|0.15|Saving an edited example as user work creates a separately retrievable saved copy while reselecting the built-in example after reload restores its unchanged original filename/source.
''',
'language_dispatch': '''
js_dispatch|0.20|A supported JavaScript filename causes the authored JS DOM and console markers to execute without synchronizing a separate language selector; lowercase fallback may establish ordinary JS support independently of extension-case handling.
html_dispatch|0.20|A supported HTML filename executes the complete authored HTML document and replaces the preceding document without synchronizing a separate selector; lowercase fallback may establish ordinary HTML support independently of extension-case handling.
css_apply|0.15|A supported CSS filename applies the authored red-heading stylesheet; lowercase fallback may establish ordinary CSS support independently of extension-case handling.
css_document_copy|0.15|The CSS run retains the last successful document's content and previously authored background style while applying the new stylesheet.
extension_case|0.15|Uppercase .JS, .HTML and .CSS filenames all dispatch their supported languages without changing a separate language selector. Score case handling here, not by failing the ordinary-language outcomes solely for a case defect.
js_fresh_document|0.25|The later JavaScript run has neither the prior successful document's heading nor its authored oldGlobal value. This owns fresh-JS state; the cancellation scene's old-global observation is only corroborating evidence.
css_no_script_rerun|0.20|Copying the successful HTML document for CSS does not rerun its old inline script: the recorded html-once-marker count does not increase.
css_no_inherited_handler|0.20|The real handler proven before the CSS copy is absent afterward: activating the retained button adds no dispatch-handler-marker entry.
''',
'cw_completed_preview_interactions': '''
later_click|0.20|After a successful preview has been idle for at least six seconds, its genuine button click still emits completed-interaction-click without rerunning the source.
later_keydown|0.20|After the input remains focused and untouched for another six seconds, an ordinary typed key emits completed-interaction-key without a fresh pointer click or rerun.
later_input|0.20|That deliberate edit also emits completed-interaction-input after the idle period; observing keydown alone does not establish the input handler.
completed_stop|0.30|Stop ends the completed preview's ability to emit new handler output, and a subsequent ordinary Run works. Removed/static/disabled stopped controls are valid; do not force unavailable controls.
completed_stop_feedback|0.10|Stopping the completed preview gives a visible stopped/cancelled reason. Feedback is scored separately from actual handler termination.
''',
'fresh_cancel': '''
supersede_pending|0.90|Starting B while A is genuinely pending prevents A's delayed output, DOM replacement and later success from becoming current; B remains the current result. Do not also grade inherited globals here.
stop_pending_work|0.65|Using Stop while the separate timer run is active prevents its scheduled stop-delayed work from producing later output, and an ordinary subsequent Run still works.
stop_pending_feedback|0.25|Stopping the active timer run produces a visible stopped/cancelled reason, independently of whether rollback or callback cancellation worked.
stop_pending_rollback|0.70|Stopping the active timer run retains or restores B's last-good render rather than its failed candidate; provisional display is optional.
''',
'cw_preview_origin_isolation': '''
parent_document_read|0.30|The authored attempt to read parent.document is blocked while legitimate own-document code works.
parent_document_write|0.30|The authored attempt to write parent.document is blocked and a fresh host read confirms its original title is unchanged.
parent_storage_read|0.30|The authored attempt to read the playground's origin storage is blocked while legitimate own-document code works.
parent_storage_write|0.35|The authored attempt to write the playground's origin storage is blocked and a fresh host read confirms the original probe-key value is unchanged.
''',
'cw_runtime_files_not_publicly_exposed': '''
private_database_files|0.20|The database and companion-file candidates have accepted denial/no-content/working-fallback or established intended-public-role outcomes, not private-file exposure. Apply the scenario's source ban and ambiguity protocol.
private_backend_project_files|0.15|The backend/project/package candidates have accepted denial/no-content/working-fallback or established intended-public-role outcomes, not private-file exposure. A browser asset's name alone cannot fail it.
private_repository_files|0.15|Both repository-metadata candidates have accepted denial/no-content/working-fallback or established intended-public-role outcomes, not private-file exposure. This is representative evidence, not exhaustive confidentiality proof.
''',
'cw_preview_network_requests_blocked': '''
snippet_fetch_blocked|0.25|After the matching successful transport and own-document controls, the authored fetch is refused with visible feedback and no additional exact-URL handler delivery or received external text.
snippet_image_blocked|0.25|After the matching successful transport and own-document controls, the separate authored Image request is refused with visible feedback and no additional exact-URL handler delivery or loaded external image.
''',
'cw_unsupported_execution_refusal': '''
harmless_scope_words|0.25|Ordinary strings, comments and HTML text containing the named unsupported-family words execute as harmless text and produce the positive-control paragraph/log.
eval_refused|0.25|The separate bounded eval probe is clearly refused and is not claimed to have executed successfully.
function_refused|0.25|The separate bounded Function-constructor probe is clearly refused and is not claimed to have executed successfully.
wasm_refused|0.25|The separate bounded WebAssembly probe is clearly refused and is not claimed to have executed successfully.
worker_refused|0.25|The separate self-contained Worker probe is clearly refused and is not claimed to have executed successfully.
dynamic_import_refused|0.25|The separate self-contained dynamic-import probe is clearly refused and is not claimed to have executed successfully.
unsupported_preview_preserved|0.25|The last-good scope-control render remains intact across each attempted unsupported-family run; refusal messaging is scored by the family outcomes instead.
''',
'cw_execution_budget_termination': '''
literal_loop_deadline|1.50|Both supported literal-loop forms terminate within the permitted scheduling margin of their five-second Run budget. Braced/unbraced syntax are bounded variants of this one deadline property.
literal_loop_timeout_reason|0.25|Each terminated literal-loop attempt has a visible time-limit reason rather than silently disappearing.
literal_loop_early_logs|0.50|The console retains each authored before-hang marker even if it arrives with the timeout.
literal_loop_rollback|0.75|After each literal-loop timeout, the last-good timeout-control render is retained/restored rather than a failed or empty candidate.
literal_loop_recovery|0.50|After termination, the editor accepts a genuine ordinary recovery Run and its authored DOM/console outputs occur.
''',
'cw_js_error_line_and_preview_restore': '''
js_error_message|0.25|The failed JS attempt reports the actual not-a-function error involving forEeach in the console.
js_error_line|0.25|The JS error is mapped to entered user-source line 4, without wrapper offsets.
js_error_rollback|0.25|The JS failure retains/restores js-good-preview rather than failed-partial-dom.
js_error_recovery|0.25|The editor accepts and successfully executes the new js-error-recovered source after the failure.
''',
'cw_html_error_document_line_and_preview_restore': '''
html_error_message|0.25|The complete-HTML failure reports undefinedFunctionCall in the console.
html_error_line|0.25|The HTML error is mapped to line 6 of the full entered document, including markup before its script.
html_error_rollback|0.25|The HTML failure retains/restores html-good-preview rather than Failed HTML candidate.
html_error_recovery|0.25|The editor accepts and successfully executes the new html-error-recovered source after the failure.
''',
'cw_timer_error_line_and_preview_restore': '''
timer_error_message|0.25|The thrown timer-callback error is reported with async-error-marker rather than disappearing or being claimed as success.
timer_error_line|0.25|The timer callback's error is mapped to entered user-source line 2.
timer_error_rollback|0.25|The timer failure retains/restores timer-good-preview rather than async-failed-candidate.
timer_error_recovery|0.25|The editor accepts and successfully executes timer-error-recovered after the asynchronous failure.
''',
'cw_promise_rejection_line_and_preview_restore': '''
promise_error_message|0.25|The unhandled Promise rejection is reported with promise-error-marker rather than silently claimed as success.
promise_error_line|0.25|The unhandled rejection is mapped to entered user-source line 2.
promise_error_rollback|0.25|The rejection retains/restores promise-good-preview rather than promise-failed-candidate.
promise_error_recovery|0.25|The editor accepts and successfully executes promise-error-recovered after the rejection.
''',
'console_levels': '''
console_four_levels_captured|0.40|The four explicit log/warn/error/info calls produce their exact authored string values. An explicit console.error is a log call, not an uncaught exception.
console_order|0.30|Those entries appear in their authored relative order.
console_level_indicators|0.30|The captured entries have unambiguous level indicators that distinguish their four levels; no particular palette is required.
''',
'console_objects': '''
console_object_fields|0.50|Expanding the logged object through the application's controls exposes its tag and nested properties rather than an opaque object summary.
console_nested_object|0.50|Expanding nested exposes deep with nested-value rather than stopping inspection at the first level.
console_array_elements|0.50|Inspecting the logged array through the application's controls exposes the individual values 11, 22 and 33.
''',
'console_controls': '''
console_history|0.30|Earlier log entries remain between successive runs until Clear is used.
console_duration|0.30|The completed run displays a measured duration rather than a blank or placeholder.
console_preserve_scroll|0.30|Appending a new run's entry while the console is deliberately scrolled upward does not jump the user's view to the bottom.
console_follow_bottom|0.30|Appending a new entry while the user is at the bottom brings it into view automatically.
console_clear_control|0.30|Activating the ordinary Clear console control removes the prior log rows; unrelated status/duration labels may remain.
''',
'auto_run': '''
autorun_typing_pause|0.40|With Auto-run enabled, the final valid edit runs after a short typing pause within about two seconds without pressing Run.
autorun_debounce_reset|0.50|Real edits closer together than the measured delay postpone execution: no intermediate source executes and only the final version runs after the final pause.
autorun_off_stays_idle|0.30|With Auto-run already off, a new edit remains unexecuted for the full measured-delay-plus-margin observation window.
autorun_off_cancels_queue|0.40|Switching Auto-run off before its queued debounce expires cancels that pending automatic execution for the full observation window.
manual_run_autorun_off|0.20|The ordinary Run control executes the edited source while Auto-run is off.
manual_run_autorun_on|0.20|The ordinary Run control also starts a fresh successful execution while Auto-run is on and there is no pending typing debounce.
''',
'pane_resize': '''
pane_dividers_work|0.25|The relevant divider controls actually change both editor/preview and preview/console allocations while all three panes remain usable.
pane_sizes_persist|0.25|The deliberately changed allocations survive a normal reload; no fixed arrangement or exact pixels are required.
''',
'editor_basics': '''
editor_monospace|0.10|The populated editor uses a monospaced face.
editor_line_numbers|0.15|The populated editor shows real line numbers for its entered source.
editor_js_syntax|0.15|Representative JavaScript receives visible syntax colouring rather than one flat token colour.
editor_html_syntax|0.15|Representative complete HTML receives visible syntax colouring rather than one flat token colour.
editor_css_syntax|0.15|Representative CSS receives visible syntax colouring rather than one flat token colour.
editor_matching_brackets|0.30|Putting the cursor immediately beside either brace of a complete pair visibly identifies the matching pair.
''',
'editor_indent': '''
editor_multiline_indent|0.50|Tab indents every selected line by one consistent level while preserving the code. Selection retention is not required; reselect before the unindent probe if needed.
editor_multiline_unindent|0.50|Shift+Tab removes one matching level from every selected indented line and returns the exact original code. If Tab failed, establish a manually indented selection to test unindent independently.
''',
'save_load': '''
new_draft_independent_identity|0.50|Saving the two separate new drafts creates two distinct stable saved identities rather than overwriting one record.
saved_record_load_fidelity|0.50|Loading each saved record restores its own exact title, filename and source without cross-record field mixing.
saved_records_browser_reload|0.50|Both saved identities and exact fields remain retrievable after a normal browser reload rather than living only in the editor buffer.
''',
'cw_process_restart_durability': '''
restart_saved_fields|0.90|After the one real process restart, the recorded identities/titles remain exactly once and both records load their exact saved fields, including the pre-restart update.
restart_revisions|0.60|The saved records' logical revisions survive the complete process restart; do not invent numeric or transport-token formats beyond observed revision semantics.
restart_current_save|1.00|A current-revision save after restart persists new Primary source and advances its revision while Second and unrelated saved records stay unchanged.
''',
'persistent_snippets': '''
save_updates_current_identity|0.30|A's successful ordinary Save updates its loaded identity's title, filename and source rather than creating another record or updating a different identity.
successful_save_revision|0.20|That successful saved change advances the record's observed revision.
stale_save_server_refusal|0.90|The otherwise-valid old-revision update is refused by the server without changing any newer saved field or revision. Use actual observed request shape; unrelated validation failure is not evidence.
stale_save_ui_feedback|0.40|The real stale editor receives useful conflict feedback, including a proactive prevention flow when appropriate; a disabled Save with no explanation is insufficient.
stale_save_draft_retained|0.70|B's actual dirty title, filename and source remain exactly intact across A's update and B's conflict flow. A request replay alone cannot establish this.
stale_save_deliberate_recovery|0.50|After deliberately loading the latest record, B can reapply and save its edit using the current revision, and the reapplication survives reload.
''',
'cw_title_change_uniqueness': '''
title_trim_on_create|0.15|Creating an otherwise valid record from the padded unused title stores/displays the exact trimmed title after a fresh read.
title_trim_on_rename|0.15|Renaming to the padded unused title stores/displays its exact trimmed title after a fresh read.
rename_title_only|0.30|An ordinary current rename changes only the selected record's title; its filename/source and the sibling's complete record remain unchanged.
title_collision_ui|0.20|The ordinary UI collision attempt receives a useful refusal and does not silently replace either title or saved record.
title_collision_server|0.25|The observed server write rejects the current-revision duplicate title, including its padded equivalent, without changing either complete record or revision.
title_empty_rejected|0.20|Empty and whitespace-only titles are refused with otherwise-valid current data and no saved-state mutation; arbitrary title-length limits are not required.
title_case_sensitive|0.25|The distinct lowercase title can coexist with the existing case-distinct title under its own identity and exact fields.
''',
'cw_stale_rename_preserves_newer_record': '''
stale_rename_refusal|1.50|With a successful current rename as control, the valid old-revision rename is refused with useful conflict feedback and every newer field/revision intact; deliberately reloading the current revision allows valid renaming again. This is the single stale-rename protection outcome, not general trimming/uniqueness grading.
''',
'cw_independent_snippet_copy': '''
duplicate_initial_fidelity|0.75|The new duplicate has its chosen title and a distinct stable identity while initially retaining the original filename and exact source.
duplicate_edit_independence|1.25|Subsequent edits to either copy remain independent after reload: changing Original cannot change Copy and changing Copy cannot change Original.
duplicate_collision_refusal|0.50|An otherwise-valid duplicate/create request cannot overwrite an existing same-title copy or create another same-title record; a new unused title remains accepted.
''',
'delete_confirm': '''
delete_confirmation|0.25|A normal delete action asks before removing the selected record.
delete_cancel_preserves|0.35|Cancelling that confirmation leaves the complete library, target fields/revision and sibling unchanged after reload.
delete_confirmed_selected_only|0.40|Confirming the deletion removes only the selected identity, preserves sibling/unrelated records, and remains deleted after reload. Missing confirmation is owned by its own outcome; use the actual ordinary delete operation to observe removal.
''',
'cw_stale_delete_preserves_newer_record': '''
stale_delete_refusal|1.00|After a real current-delete control and a newer saved Target revision, the valid old-revision delete is refused with useful feedback and newer records intact; deleting with the deliberately loaded current revision still succeeds. Confirmation UI and removed-identity updates are not graded here.
''',
'cw_deleted_identity_rejects_update': '''
deleted_identity_update_refusal|1.00|Updating the confirmed-removed identity in the observed valid update shape is refused with useful feedback, without recreating that identity or a replacement record or mutating unrelated records; a valid existing-record update still works. This does not grade deletion confirmation or stale deletion.
''',
'cw_dirty_workspace_transition_warnings': '''
current_record_identity_visible|0.10|The workspace makes the currently edited snippet identifiable even when its fields have unsaved changes.
source_dirty_indicator|0.15|Changing only the source from a clean loaded record produces a visible unsaved-change indication.
title_dirty_indicator|0.15|Changing only the title from a clean loaded record produces a visible unsaved-change indication.
filename_dirty_indicator|0.15|Changing only the filename from a clean loaded record produces a visible unsaved-change indication.
dirty_load_warning|0.05|Loading another saved snippet warns before replacing the dirty draft.
dirty_load_cancel|0.05|Cancelling the saved-snippet replacement preserves the exact dirty title, filename and source.
dirty_load_accept|0.05|Accepting that replacement actually loads the selected destination record.
dirty_example_warning|0.05|Choosing an example warns before replacing the dirty draft.
dirty_example_cancel|0.05|Cancelling the example replacement preserves the exact dirty title, filename and source.
dirty_example_accept|0.05|Accepting that replacement actually loads the selected example.
dirty_new_warning|0.05|Starting a new draft warns before replacing the dirty draft.
dirty_new_cancel|0.05|Cancelling the new-draft replacement preserves the exact dirty title, filename and source.
dirty_new_accept|0.05|Accepting that replacement actually reaches the independent new draft; no default title, filename or template is prescribed.
dirty_import_warning|0.05|Importing a supported file warns before replacing the dirty draft.
dirty_import_cancel|0.05|Cancelling the import replacement preserves the exact dirty title, filename and source.
dirty_import_accept|0.05|Accepting that replacement actually brings the chosen file's filename/source into the workspace. General import fidelity and execution behavior are owned by the import scenario.
discarded_edits_not_saved|0.10|The original saved Base title, filename and source remain unchanged after the dirty drafts are discarded through those replacement actions.
''',
'cw_native_dirty_leave_warning': '''
clean_leave_no_warning|0.15|A normal reload of a clean saved workspace does not produce a dirty-work leave warning.
dirty_native_warning|0.20|After real keyboard interaction creates dirty source, requesting reload shows the browser's native leave-page warning, not only a custom app dialog.
native_leave_cancel|0.20|Dismissing the native warning prevents navigation and retains the exact dirty fields; an automation navigation timeout does not itself fail this result.
native_leave_accept|0.20|Accepting the native warning permits the actual reload, after which the original saved record remains unchanged and usable.
''',
'cw_exact_source_file_export': '''
export_exact_source_file|0.50|The ordinary export produces an actual download with the draft's exact actual filename and unchanged source bytes/text; a toast or filename label is insufficient, and saving is not a prerequisite.
''',
'cw_supported_source_file_import': '''
import_exact_draft|0.40|Importing the supported lowercase control file through the actual file input produces its exact filename and source in an editable draft.
import_off_no_execution|0.30|With Auto-run off, importing source does not execute it: the last-good output remains and authored imported markers are absent until ordinary Run is deliberately activated.
import_unsupported_extension|0.30|The unsupported source-file extension receives a useful refusal while the existing title, filename and source remain unchanged.
saved_filename_extension_rejection|0.30|An otherwise-valid current-revision server write rejects unsupported.txt and preserves every saved field/revision.
saved_filename_path_rejection|0.30|An otherwise-valid current-revision server write rejects nested/demo.js as a path and preserves every saved field/revision.
import_extension_case|0.10|The uppercase .JS source file is accepted by import; test this separately from the lowercase exact-import control.
saved_filename_extension_case|0.10|The actual save/update accepts the supported uppercase .JS filename and retrieves it unchanged, independently of importer case handling.
imported_draft_edit_save|0.20|The imported draft can be edited and saved as user work, with the changed source surviving a fresh load. If uppercase handling fails, use the supported lowercase filename to observe editing/saving independently.
''',
'cw_theme_switch_legibility': '''
theme_actual_switch|0.30|The offered control actually switches workspace chrome, editor and console into both appearances rather than only changing a label; either may be the starting theme.
theme_work_preserved|0.20|Switching themes retains the exact title, filename, source and existing preview/console output. Palette/readability and authored preview colours are not graded here.
''',
'cw_keyboard_shortcut_actions': '''
shortcut_documentation|0.10|Users can find the app's visible working shortcut documentation for Run, Save and Clear console.
shortcut_run|0.30|The documented Run shortcut alone starts the authored keyboard-marker DOM and keyboard-log console result without clicking Run.
shortcut_save|0.30|The documented Save shortcut alone saves the same draft's exact title, filename and source to the library without clicking Save.
shortcut_clear|0.30|The documented Clear console shortcut alone removes prior rows without clicking Clear.
''',
'cw_shared_run_deadline_recovery': '''
callback_shared_run_deadline|0.80|The entered four-second callback is bounded by the original Run's five-second budget rather than a fresh callback-entry budget, with termination inside the permitted margin from the actual Run action and no later resumption.
callback_timeout_reason|0.15|The shared-run callback timeout produces a visible time-limit reason.
callback_timeout_rollback|0.35|That timed-out attempt retains/restores recovery-marker-Q7 rather than failed-loop-candidate; provisional display is optional.
callback_timeout_recovery|0.20|A fresh ordinary editor Run produces shared-deadline-recovered and its console marker after the timeout.
''',
'cw_pending_interaction_budget_nonextension': '''
interaction_success_commit|0.20|The ordinary successful Commit change interaction leaves interaction-committed visibly committed without rerunning the original source.
interaction_budget_no_extension|0.30|The pending interaction times out under its original shared budget despite the later input attempt or observed input prevention, and its six-second late work never resumes. Further input may be accepted, ignored or blocked.
interaction_timeout_reason|0.10|The pending interaction timeout has a visible time-limit reason.
interaction_latest_rollback|0.30|The failed pending interaction retains/restores the earlier successful interaction-committed state, not the original interaction-good or provisional/late state; a static restored snapshot is valid.
interaction_timeout_recovery|0.10|A fresh ordinary Run produces interaction-budget-recovered and its console marker after the timed-out interaction.
'''
}

def merge(parent, key, oldkeys, result):
    rows = [line.strip().split('|', 2) for line in plans[parent].strip().splitlines()]
    chosen = [r for r in rows if r[0] in oldkeys]
    assert len(chosen) == len(oldkeys), (parent, oldkeys)
    weight = sum(Decimal(r[1]) for r in chosen)
    first = min(i for i,r in enumerate(rows) if r[0] in oldkeys)
    retained = [r for r in rows if r[0] not in oldkeys]
    retained.insert(first, [key, format(weight, 'f'), result])
    plans[parent] = '\n'.join('|'.join(r) for r in retained)

# Consolidate evidence micro-assertions into independently useful product outcomes.
# A variant of one rule is not a new user feature; controls/recovery are intrinsic.
merge('initial_examples','startup_ready',['startup_source','startup_preview','startup_console'],'Opening a fresh workspace supplies useful source and automatically produced preview/console output without pressing Run; no particular example or saved identity is required.')
merge('initial_examples','usable_examples',['example_editable','example_output'],'A chosen built-in example loads useful editable source and can produce working output; a real authored edit establishes editability. Saving changes to its template is scored separately.')
merge('language_dispatch','js_html_filename_dispatch',['js_dispatch','html_dispatch'],'Supported JS and complete HTML sources execute in their respective filename-selected modes without synchronizing a separate language selector. Use lowercase fallback to separate ordinary dispatch from uppercase-extension failure.')
merge('language_dispatch','css_apply_snapshot',['css_apply','css_document_copy'],'CSS applies its new stylesheet to a fresh copy of the last successful document while retaining that document content and previously authored style.')
merge('language_dispatch','css_inert_copy',['css_no_script_rerun','css_no_inherited_handler'],'The CSS copy neither reruns the proven old inline script nor carries the previously proven live event handler: their recorded marker counts do not increase after copying and trying the retained button.')
merge('cw_completed_preview_interactions','later_interactions',['later_click','later_keydown','later_input'],'A completed preview remains genuinely interactive after the two six-second idle periods: the real click and later focused keyboard/input actions produce their authored handler markers without rerunning source.')
merge('cw_completed_preview_interactions','completed_stop',['completed_stop','completed_stop_feedback'],'Stop on the completed interactive preview gives a stopped reason and prevents subsequent old-handler output; removed/static/disabled stopped controls are valid and a new ordinary Run still works.')
merge('fresh_cancel','stop_pending_execution',['stop_pending_work','stop_pending_feedback'],'Stop on a genuinely pending timer run visibly reports stopped/cancelled and prevents its scheduled work from producing later output; an ordinary new Run still works. Preview rollback is independently scored.')
merge('cw_preview_origin_isolation','preview_origin_boundary',['parent_document_read','parent_document_write','parent_storage_read','parent_storage_write'],'The authored parent-document and origin-storage read/write attempts are blocked, fresh host observations remain unchanged, and legitimate own-document execution still works. These are representative access operations for one origin boundary.')
merge('cw_runtime_files_not_publicly_exposed','working_files_private',['private_database_files','private_backend_project_files','private_repository_files'],'All nine representative working-file probes have accepted denial/no-content/working-fallback or established intended-public-role outcomes rather than private-file exposure. Apply the source ban, ambiguity protocol and healthy controls; this is not an exhaustive privacy guarantee.')
merge('cw_preview_network_requests_blocked','snippet_network_boundary',['snippet_fetch_blocked','snippet_image_blocked'],'After successful matching transport and own-document controls, separate authored fetch and Image attempts are visibly refused and cause no extra exact-URL deliveries or external content loads. These are representative mechanisms of the single snippet network boundary.')
merge('cw_unsupported_execution_refusal','unsupported_execution_refused',['eval_refused','function_refused','wasm_refused','worker_refused','dynamic_import_refused','unsupported_preview_preserved'],'Each bounded named out-of-scope execution attempt is clearly refused without success or loss of the last-good render, and ordinary execution recovers. Run all five families separately; harmless word/text acceptance is independently scored.')
merge('cw_execution_budget_termination','literal_loop_deadline',['literal_loop_deadline','literal_loop_timeout_reason','literal_loop_early_logs','literal_loop_recovery'],'Both supported literal-loop forms terminate within the permitted margin of the five-second budget with a visible time-limit reason, preserved pre-hang logs and a usable recovery Run. These are viability/attribution checks for termination; preview rollback is separately scored.')
for parent, stem in [('cw_js_error_line_and_preview_restore','js'),('cw_html_error_document_line_and_preview_restore','html'),('cw_timer_error_line_and_preview_restore','timer'),('cw_promise_rejection_line_and_preview_restore','promise')]:
    rows = [line.strip().split('|',2) for line in plans[parent].strip().splitlines()]
    rollback = next(r[2] for r in rows if r[0] == stem+'_error_rollback')
    merge(parent,stem+'_error_rollback',[stem+'_error_rollback',stem+'_error_recovery'],rollback + ' A fresh ordinary Run remains usable afterward; this recovery is intrinsic to the error-restoration outcome.')
merge('console_levels','console_level_stream',['console_four_levels_captured','console_order','console_level_indicators'],'The authored log/warn/error/info calls form an ordered stream with exact values and unambiguous level indicators; explicit console.error is a logged level, not an uncaught execution failure.')
merge('console_objects','console_value_inspection',['console_object_fields','console_nested_object','console_array_elements'],'The app inspection controls expose the logged object properties, nested deep value and individual array elements, rather than opaque summaries. Objects/nesting/arrays are representative values of one inspection feature.')
merge('console_controls','console_scroll_policy',['console_preserve_scroll','console_follow_bottom'],'New entries follow automatically when the user is at the bottom, while deliberately scrolling up preserves the reading position when another entry arrives.')
merge('auto_run','autorun_debounce',['autorun_typing_pause','autorun_debounce_reset'],'Enabled Auto-run waits for a brief typing pause, resets that wait on each closer-spaced real edit, and executes only the final source after the pause within about two seconds. Measure the actual delay instead of prescribing a debounce constant.')
merge('auto_run','manual_run_independent_of_autorun',['manual_run_autorun_off','manual_run_autorun_on'],'The ordinary Run control starts a genuine authored execution both with Auto-run on and with it off; the on-state proof has no pending edit debounce.')
merge('editor_basics','editor_syntax_colouring',['editor_js_syntax','editor_html_syntax','editor_css_syntax'],'Representative JS, complete HTML and CSS source each receive visible syntax colouring under their corresponding filenames; these are language variants of the same editor feature.')
merge('save_load','saved_record_fidelity',['new_draft_independent_identity','saved_record_load_fidelity'],'Saving separate new drafts gives distinct stable records, and loading each returns its own exact title, filename and source. Also use the actual S23 newer Save observation to confirm Save updates its current loaded identity rather than adding another record; that write is a control for S23, not a second scored owner.')
merge('cw_process_restart_durability','process_restart_durability',['restart_saved_fields','restart_revisions','restart_current_save'],'The one real process restart preserves the full recorded identities/fields/logical revisions exactly once; a current-revision post-restart save still persists and advances only its target record. The successful continuing write is the durability control, not a separate CRUD or copy/delete prerequisite.')
merge('persistent_snippets','stale_save_server_refusal',['save_updates_current_identity','successful_save_revision','stale_save_server_refusal'],'After a real newer Save control advances the same identity/revision, the otherwise-valid old-revision update is refused by the server without changing newer saved fields/revision. Current-update fidelity is owned by S21; here it establishes a meaningful stale-write control.')
merge('persistent_snippets','stale_save_draft_recovery',['stale_save_ui_feedback','stale_save_draft_retained','stale_save_deliberate_recovery'],'The actual dirty editor receives useful conflict feedback while retaining its exact unsaved fields, and deliberate reload/reapplication using the latest revision succeeds. Proactive prevention is valid; request replay alone cannot establish this user recovery flow.')
merge('cw_title_change_uniqueness','title_trimming',['title_trim_on_create','title_trim_on_rename'],'Creating and renaming with the padded unused titles stores/displays the exact trimmed titles after fresh reads; these are write-operation variants of title normalization.')
merge('cw_title_change_uniqueness','title_collision_refusal',['title_collision_ui','title_collision_server'],'The actual UI and observed server write refuse an otherwise-valid current-revision exact or padded title collision with useful feedback and no mutation of either complete record/revision; unrelated stale or validation errors are not evidence.')
merge('delete_confirm','delete_confirmation_cancel',['delete_confirmation','delete_cancel_preserves'],'Deletion asks before removing the target, and cancelling preserves the complete library and exact records after reload. Confirmed selected-record removal is separately scored.')
merge('cw_dirty_workspace_transition_warnings','dirty_workspace_identity',['current_record_identity_visible','source_dirty_indicator','title_dirty_indicator','filename_dirty_indicator'],'The workspace identifies the edited snippet and visibly marks unsaved work when source, title or filename alone changes from the clean loaded record.')
merge('cw_dirty_workspace_transition_warnings','dirty_transition_protection',['dirty_load_warning','dirty_load_cancel','dirty_example_warning','dirty_example_cancel','dirty_new_warning','dirty_new_cancel','dirty_import_warning','dirty_import_cancel'],'Each of the four in-app replacement routes warns before overwriting dirty work, and cancelling keeps the exact title, filename and source. Independently re-establish the dirty fixture before each route; accepted transitions are scored separately.')
merge('cw_dirty_workspace_transition_warnings','dirty_transition_acceptance',['dirty_load_accept','dirty_example_accept','dirty_new_accept','dirty_import_accept','discarded_edits_not_saved'],'Accepting each warned replacement actually reaches the selected saved record, example, independent new draft or imported file, while discarded edits never change the original saved Base. No particular new-draft template is required.')
merge('cw_native_dirty_leave_warning','native_dirty_leave_protection',['clean_leave_no_warning','dirty_native_warning','native_leave_cancel','native_leave_accept'],'After genuine keyboard interaction, dirty work receives the browser-native leave warning: dismissal retains the exact draft and acceptance permits reload while saved data remains intact. A clean workspace does not spuriously warn. These are the positive/negative branches of the one native leave protection behavior.')
merge('cw_supported_source_file_import','supported_file_import',['import_exact_draft','imported_draft_edit_save'],'A supported lowercase file imports through the real file input with its exact filename/source into an editable, saveable draft; an edit can be saved/reloaded. Use lowercase supported data so case handling and invalid-filename rules do not gate basic import.')
merge('cw_supported_source_file_import','source_file_extension_case',['import_extension_case','saved_filename_extension_case'],'The uppercase .JS filename is accepted by both import and saving, with its filename retrieved unchanged; observe the two layers independently, using an already-imported lowercase draft to test saving if importer case support fails.')
merge('cw_keyboard_shortcut_actions','shortcut_run',['shortcut_documentation','shortcut_run'],'Users can find the documented Run binding and use that shortcut alone to produce keyboard-marker and keyboard-log without clicking Run. Record available Save/Clear documentation alongside their separately owned actions.')
merge('cw_shared_run_deadline_recovery','callback_shared_run_deadline',['callback_shared_run_deadline','callback_timeout_reason','callback_timeout_recovery'],'The entered four-second callback terminates on the original Run budget, visibly reports time limit, never resumes and permits a fresh ordinary Run. Do not grant a new clock at callback entry; rollback is independently scored.')
merge('cw_pending_interaction_budget_nonextension','interaction_budget_no_extension',['interaction_budget_no_extension','interaction_timeout_reason','interaction_timeout_recovery'],'The pending interaction expires with a visible time-limit reason under its original shared budget despite additional input or observed input prevention; its six-second callback never resumes and an ordinary new Run works. Further pending input may be accepted, ignored or blocked.')
merge('cw_pending_interaction_budget_nonextension','interaction_latest_rollback',['interaction_success_commit','interaction_latest_rollback'],'After an actually observed successful DOM-changing interaction commits interaction-committed, the later failing interaction retains/restores that latest committed render rather than initial interaction-good or provisional/late state. The first commit is the necessary rollback baseline, not a second reward.')

# Fixed marker names would contradict the explicit successful-recovery handoffs.
for parent in ('cw_execution_budget_termination', 'cw_js_error_line_and_preview_restore', 'cw_html_error_document_line_and_preview_restore', 'cw_timer_error_line_and_preview_restore', 'cw_promise_rejection_line_and_preview_restore', 'cw_shared_run_deadline_recovery'):
    for marker in ('timeout-control', 'js-good-preview', 'html-good-preview', 'timer-good-preview', 'promise-good-preview', 'recovery-marker-Q7'):
        plans[parent] = plans[parent].replace(marker, 'the recorded currentLastGood render')

requirements = {
'initial_examples':'overview.md:3,9; instruction.md opening-state and examples paragraphs',
'language_dispatch':'overview.md:5; behaviour.md:5',
'cw_completed_preview_interactions':'behaviour.md:11; security.md:3',
'fresh_cancel':'behaviour.md:7,13',
'cw_preview_origin_isolation':'security.md:3',
'cw_runtime_files_not_publicly_exposed':'security.md:11',
'cw_preview_network_requests_blocked':'security.md:9',
'cw_unsupported_execution_refusal':'security.md:7',
'cw_execution_budget_termination':'behaviour.md:9,13; security.md:5',
'cw_js_error_line_and_preview_restore':'behaviour.md:13,15',
'cw_html_error_document_line_and_preview_restore':'behaviour.md:13,15',
'cw_timer_error_line_and_preview_restore':'behaviour.md:13,15',
'cw_promise_rejection_line_and_preview_restore':'behaviour.md:13,15',
'console_levels':'behaviour.md:19', 'console_objects':'behaviour.md:19', 'console_controls':'behaviour.md:19',
'auto_run':'behaviour.md:21', 'pane_resize':'ui.md:3', 'editor_basics':'ui.md:5', 'editor_indent':'ui.md:5',
'save_load':'behaviour.md:25; integration.md:7', 'cw_process_restart_durability':'integration.md:7; behaviour.md:31',
'persistent_snippets':'behaviour.md:25,31', 'cw_title_change_uniqueness':'behaviour.md:27,29',
'cw_stale_rename_preserves_newer_record':'behaviour.md:31', 'cw_independent_snippet_copy':'behaviour.md:25,27,29',
'delete_confirm':'behaviour.md:29', 'cw_stale_delete_preserves_newer_record':'behaviour.md:31',
'cw_deleted_identity_rejects_update':'behaviour.md:31', 'cw_dirty_workspace_transition_warnings':'behaviour.md:35',
'cw_native_dirty_leave_warning':'behaviour.md:35', 'cw_exact_source_file_export':'behaviour.md:37',
'cw_supported_source_file_import':'behaviour.md:27,37,39', 'cw_theme_switch_legibility':'ui.md:9',
'cw_keyboard_shortcut_actions':'ui.md:7', 'cw_shared_run_deadline_recovery':'behaviour.md:9; security.md:5',
'cw_pending_interaction_budget_nonextension':'behaviour.md:11,13'
}
nominal_actions = [18,26,15,18,10,24,16,22,16,10,10,10,10,5,8,13,24,8,16,8,18,20,25,30,20,24,18,22,22,45,18,6,32,10,13,12,16]
compact_outcomes = dict(line.split('|', 1) for line in (out / 'compact-outcomes.txt').read_text(encoding='utf-8').splitlines() if line.strip())
assert len(original['criterion']) == 37
assert set(plans) == {c['id'] for c in original['criterion']}
header = source.split('[[criterion]]', 1)[0]
judge = header
mapping = []
scenario_sections = []
used_ids = set()
for n, old in enumerate(original['criterion'], 1):
    scene = f'S{n:02}'
    rows = [line.strip().split('|', 2) for line in plans[old['id']].strip().splitlines()]
    assert sum(Decimal(r[1]) for r in rows) == Decimal(str(old['weight'])), (old['id'], rows)
    protocol = old['description'].strip().replace("this criterion's", "this scenario's").replace('This criterion', 'This scenario').replace('this criterion', 'this scenario')
    protocol = '\n'.join(line for line in protocol.splitlines() if not line.startswith('All legs must be observed.'))
    refinements = ''
    # These are explicit protocol edits, not a global exception to own-control text.
    if n == 4:
        protocol = protocol.replace('1. Turn auto-run off. Run a short successful .js snippet producing a stable paragraph and console marker, establishing a last-good preview.', '1. With Auto-run off, reuse the actually successful S03 recovery as currentLastGood. If unavailable, run one ordinary DOM/log control now.')
    elif n == 6:
        protocol = protocol.replace('1. Through the UI, run ordinary .js source that renders confidentiality-control-preview and logs confidentiality-control-log. Confirm both. This working control prevents a broken server from passing a denial check.', '1. Reuse the actually successful S05 recovery DOM/log as the healthy workspace control. If unavailable, run one ordinary DOM/log control now. Keep this original workspace page for the final recovery.')
    elif n == 7:
        protocol = protocol.replace('With auto-run off, use the playground UI to run a legitimate .js own-document update and console marker, proving ordinary execution works and establishing a last-good preview.', 'With Auto-run off, reuse the actually successful final S06 Run as the own-document DOM/log control; if unavailable, run one ordinary DOM/log control now.')
    elif n == 9:
        protocol = protocol.replace('1. Run a short valid .js snippet producing timeout-control in the preview and console. Then run:', '1. Reuse the actually successful S08 recovery DOM/log as currentLastGood; if unavailable, run one ordinary DOM/log control. Record its actual completed render. Then run:').replace('The preview restores timeout-control.', 'The preview retains/restores recorded currentLastGood.')
    elif n in (10, 11, 12, 13):
        protocol = re.sub(r'^1\..*?\n2\.', f'1. Reuse the actually successful S{n-1:02} recovery DOM/log as currentLastGood; if unavailable, run one ordinary DOM/log control. Record its actual completed render.\n2.', protocol, count=1, flags=re.S)
        for marker in ('js-good-preview', 'html-good-preview', 'timer-good-preview', 'promise-good-preview'):
            protocol = protocol.replace(marker, 'recorded currentLastGood')
    elif n == 31:
        protocol = re.sub(r'^1\..*?\n2\.', "1. Load the freshly verified unchanged saved QC Dirty Base from S30, recording its actual clean fields. If unavailable, create QC Native Leave (qc-native-leave.js, console.log('native-leave-original');) once as fallback. With no unsaved change, reload and confirm usable workspace without a dirty-work leave warning.\n2.", protocol, count=1, flags=re.S)
        protocol = protocol.replace('Load QC Native Leave and confirm its original saved source is unchanged.', 'Load the recorded saved control and confirm its exact original saved fields are unchanged.')
    elif n == 33:
        protocol = protocol.replace("1. Turn auto-run off. Establish a successful ordinary .js run that renders import-good-preview and logs import-good-log, then save it as this scenario's own QC Import Preview Control so the workspace is clean. Note the last-good output and console entries.", "1. With Auto-run off, reuse S17's actually successful final manual Run as currentLastGood; if unavailable, run one ordinary DOM/log control now. Save the current source as QC Import Preview Control so the workspace is clean, and record actual preview/log baseline.")
    elif n == 34:
        protocol = protocol.replace("With auto-run off, establish this scenario's own normal .js run that renders theme-control-preview and logs theme-control-log.", "With Auto-run off, reuse S16's actually completed third Run before its Clear step, including visible console rows and its actual preview. If unavailable, run one ordinary DOM/log control.")
    elif n == 36:
        protocol = re.sub(r'^1\..*?\n2\.', '1. Reuse the actually successful S13 recovery DOM/log as currentLastGood; if unavailable, run one ordinary DOM/log control now. Record the completed preview. No library save/reload is required.\n2.', protocol, count=1, flags=re.S)
        protocol = protocol.replace('last-good recovery marker', 'recorded currentLastGood render').replace('original recovery marker', 'recorded currentLastGood render')
    if n == 16:
        protocol = protocol.replace("Run console.log('after-scroll-down');.", "Run document.body.innerHTML='<p>theme-shared-preview</p>'; console.log('after-scroll-down');.")
        protocol = protocol.replace("4. Use Clear console. Prior log rows are gone. An empty-state hint is allowed. Do not demand that run durations or unrelated status labels elsewhere disappear.", "4. First execute S34 using this actual completed state with nonempty console; do not Run again for that theme control. Then use Clear console. Prior log rows are gone. An empty-state hint is allowed. Do not demand that run durations or unrelated status labels elsewhere disappear.")
    if n == 1:
        protocol = protocol.replace('3. Choose that original example again,', '3. In phase 6, choose that recorded original example again,')
    if n == 20:
        protocol = protocol.replace('all source remains intact; the selection still covers the three lines. Press Shift+Tab with that selection:', 'all source remains intact. Reselect the same three lines if needed and press Shift+Tab:')
    if n == 35:
        protocol = protocol.replace('3. Keep that same draft and source, set title QC Keyboard Save and filename qc-keyboard.js, then trigger Save', '3. Defer to phase 6: re-enter the recorded authored source in a fresh draft (no additional Run needed), set title QC Keyboard Save and filename qc-keyboard.js, then trigger Save')
        protocol = protocol.replace('4. Trigger Clear console through its shortcut;', "4. If the Run shortcut did not produce console rows, use ordinary manual Run once to establish nonempty console output solely as the Clear shortcut's independent control; this cannot earn Run-shortcut credit. Trigger Clear console through its shortcut;")
    if old['id'] == 'language_dispatch':
        protocol = protocol.replace('dispatch.html', 'dispatch.HTML').replace('<h1 id="dispatch-mark">', '<style>#dispatch-mark { background-color: rgb(1, 2, 3); }</style><h1 id="dispatch-mark">')
        refinements = 'For independent case attribution, if an uppercase extension prevents a language run, record that uppercase failure and retry the same valid source once with the lowercase extension. Continue ordinary language/CSS-state observations from that supported lowercase run. In the CSS copy also confirm the previously authored background colour survives. No additional selector is used.'
    elif old['id'] == 'auto_run':
        refinements = 'After the first automatic run has completed, keep Auto-run on, do not edit, record marker-entry counts, and press ordinary Run once. Observe one additional genuine authored execution. This directly tests manual Run with Auto-run on without confusing it with a queued edit.'
    elif old['id'] == 'editor_indent':
        refinements = 'If Tab fails, record its result, then enter the same three lines manually with one consistent indentation level, select them and test Shift+Tab. A Tab failure must not prevent independent unindent evidence.'
    elif old['id'] == 'cw_independent_snippet_copy':
        protocol = protocol.replace("Edit and save only Copy to console.log('copy-edited-source');. Reload and confirm Original still contains its original source while Copy contains the edit.", "Edit/save only Original to console.log('original-independently-edited'); and reload Copy: its initial copied source is unchanged. Then edit/save only Copy to console.log('copy-edited-source');. Reload both: Original retains its separately edited source and Copy retains its own edit.")
    elif old['id'] == 'cw_dirty_workspace_transition_warnings':
        refinements = 'Also establish a clean Base, change only its source, and observe its dirty indication before any title/filename change. Keep the existing title-only and filename-only cycles. Record warning appearance, cancelled draft preservation and accepted destination as three distinct observations for each of the four transitions. Missing warning does not automatically fail an accepted transition that actually works. If no confirmation exists, its cancellation behavior is an observed missing product capability, but still attempt/record accepted replacement using normal controls.'
    elif old['id'] == 'cw_supported_source_file_import':
        protocol = protocol.replace('Import a file named import-me.JS', 'Import a file named import-me.js')
        protocol = protocol.replace("4. Record QC Imported File's actual successful save/update operation.", "4. Record QC Imported File's actual successful save/update operation. If supported import failed, use the independently saved QC Import Preview Control for these server-filename probes instead, observing a successful current update and its actual request shape first.")
        refinements = 'Use lowercase import-me.js for exact-import/no-execution/editability evidence so a case bug cannot mask those properties. After the ordinary control, separately import the same supported source with filename import-me.JS, recording acceptance as the import-case observation. Save/update the supported uppercase filename through the actual observed write format for the separate saved-filename-case observation; if the importer refuses uppercase, set that filename on the already imported lowercase draft instead. If the server refuses uppercase, restore the lowercase supported filename before testing edit/save persistence. Do not infer either case result from a different layer. The original unsupported-extension and path writes keep otherwise-valid current revisions.'
    elif old['id'] == 'cw_process_restart_durability':
        refinements = 'Invoke restart_app only once for this whole shared scenario. Record saved field/identity survival, revision survival and the post-restart write separately from that same restart; do not restart again for each outcome.'
    elif old['id'] == 'cw_keyboard_shortcut_actions':
        refinements = 'Use each discoverable documented binding. If one cannot be discovered, record that unavailable shortcut feature; do not invent bindings or infer unrelated documented shortcuts failed. Defer only the Save leg to phase 6.'
    elif old['id'] == 'fresh_cancel':
        refinements = 'Record B freshness for traceability, but do not conjoin the oldGlobal result with cancellation credit: fresh-JS state is owned by S02.js_fresh_document. Independently record actual cancellation, visible Stop feedback and retained/restored last-good render.'
    block = f'### {scene} — {old["id"]}\n\nAbout {nominal_actions[n-1]} UI actions; execute once in the phase plan below.\n\n{protocol}\n'
    if refinements:
        block += f'\nIndependence refinement: {refinements}\n'
    children = []
    for key, weight, outcome in rows:
        outcome = compact_outcomes[key]
        cid = 'cw_' + key
        assert cid not in used_ids
        used_ids.add(cid)
        evidence = scene + '.' + key
        description = f'{evidence}: {outcome}'
        judge += '\n[[criterion]]\n' + f'id = {json.dumps(cid)}\nname = {json.dumps(cid)}\ntype = "binary"\nweight = {format(Decimal(weight), "f")}\ndescription = {json.dumps(description)}\n'
        children.append({'id': cid, 'weight': weight, 'evidence_key': evidence, 'outcome': outcome})
    mapping.append({'original_id': old['id'], 'original_weight': str(old['weight']), 'scenario': scene, 'public_requirements': requirements[old['id']], 'nominal_ui_actions': nominal_actions[n-1], 'atomic_outcomes': children})
    scenario_sections.append(block.rstrip() + '\n')

base_prompt = (task / 'tests/scored/functional/prompt.md').read_text(encoding='utf-8')
base_prompt = base_prompt.replace('- Perform the listed criteria in order on one continuous database. Each criterion is a conjunction of its stated legs. Score it from evidence gathered for those legs, not from a similar earlier success.', '- Execute the shared protocols once under the seven-phase plan below on one continuous database. Protocol numbers identify evidence, not execution order or conjunctive scores. Score each outcome independently; never rerun a protocol for its child rows.')
base_prompt = base_prompt.replace('- Before a negative or forbidden operation, perform that criterion\'s meaningful successful control.', '- Before a negative or forbidden operation, perform the shared scenario\'s meaningful successful control once and record its actual facts; sibling outcome criteria may cite that same control.')
base_prompt = base_prompt.replace('Use the exact distinct titles assigned to each criterion.', 'Use the exact distinct titles assigned to each shared scenario; its outcome rows use those same records without recreating them.')
base_prompt = base_prompt.replace('Only cw_process_restart_durability, immediately after save_load, calls the verifier MCP restart_app tool, exactly once.', 'Only shared scenario S22 (process restart), immediately after S21 (save/load), calls the verifier MCP restart_app tool, exactly once for all its outcome rows.')
base_prompt = base_prompt.replace('A missing Auto-run control is graded by auto_run, not as an unrelated prerequisite failure.', 'A missing Auto-run control is graded by its S17 outcome rows, not as an unrelated prerequisite failure.')
base_prompt = base_prompt.replace('For persistent_snippets,', 'For the S23 stale-save scenario,')
base_prompt = base_prompt.replace('For cw_preview_network_requests_blocked,', 'For S07,')
base_prompt = base_prompt.replace('Only cw_process_restart_durability', 'Only shared scenario S22')
base_prompt = base_prompt.replace('{criteria}', '')
# Keep the executable network-control recipe unchanged; compact repeated global prose.
recipe = base_prompt[base_prompt.index('## Supplied network-control recipe'):]
base_prompt = (out / 'compact-common-prompt.md').read_text(encoding='utf-8').rstrip() + '\n\n' + recipe
rules = '''
## Shared-scenario scoring contract

Each evidence key has one scored owner. Shared `.control` facts establish valid setup, not a second score. Protocol prose says what to observe; only each short outcome defines its pass boundary. Preserve separately observed results when another part fails.

Per-protocol action figures are planning estimates, not score limits. One action is a field edit, activation, upload, navigation, scroll or resize, not a keystroke; allow app-specific dialogs. Execute listed actions once, plus at most one retry for validly set up app failure, tool failure or a demonstrably missed timing window. Never repeat an entire protocol for another outcome. Batch timing and passive observations. One database/restart and existing provider/model/budgets remain; no cost or completion guarantee is implied.

## Seven-phase execution plan

1. Workspace: S01 steps 1-2 (record the chosen example; defer its Save leg); S14, S15; S16 steps 1-3, then S34 using that live state, then S16 Clear; S18, S19, S20; S35 Run/Clear and documentation (defer Save). No user-record mutations in this phase.
2. Early persistence: S21 then immediately S22's single actual restart, then S23. These record fixtures remain distinct. Do not defer the restart behind the long timing probes.
3. Language and completed interaction: S02, then S03, then S04 using S03's actual recovery as baseline. The CSS handler control precedes Stop; do not reuse a stopped handler as its positive control.
4. Failure lifecycle: S08, S09, S10, S11, S12, S13, S36, S37. The completed recovery of each of S08 through S13 supplies the next protocol's ordinary baseline. S08's harmless-words HTML and S37's successful DOM-changing interaction remain distinct required controls.
5. Editing execution/files: S17 then S33 using its final manual Run baseline; S32.
6. Remaining library features: deferred S01 example-copy leg and S35 Save leg, then S24, S25, S26, S27, S28, S29. Re-enter the recorded S35 authored source in a new draft for its Save shortcut; no extra execution is needed.
7. Dirty work and boundaries: S30 then S31 reusing the freshly loaded clean Base where valid; S05, S06, S07 in that order, sharing their actual ordinary recovery Runs. Close only created probe contexts/pages and remove S07's exact routing handlers.

Maintain `currentLastGood` as actual observed successful DOM plus the matching execution/log evidence and completed state, not a previous verdict or assumed marker. The listed handoffs remove eleven nominal redundant control Runs: S03→S04; S08→S09→S10→S11→S12→S13→S36; S17→S33; S16→S34; S05→S06→S07. Preserve each negative protocol's own bad source, timings, observations and final recovery. If a handoff was not observed successful or later work invalidated it, establish that receiving protocol's one ordinary DOM/log control before its negative action; record the earlier failure independently. A failure must not cascade from a missing inherited baseline. S31 likewise creates its dedicated clean fallback record if the actual S30 record cannot be used. These handoffs reuse setup facts, never reward ownership. Dedicated stale/collision/deletion records remain isolated, with a fresh actual revision before each logically independent rejection if earlier work unexpectedly mutated data.

'''
prompt = base_prompt.rstrip() + '\n\n' + rules + '\n'.join(scenario_sections) + '\n## Binary outcome descriptors\n\n{criteria}\n'
(draft / 'judge.toml').write_text(judge, encoding='utf-8')
(draft / 'prompt.md').write_text(prompt, encoding='utf-8')
parsed = tomllib.loads(judge)
assert sum(Decimal(str(c['weight'])) for c in parsed['criterion']) == Decimal('49.5')
assert len(parsed['criterion']) == len(used_ids)
assert parsed['judge'] == original['judge'] and parsed['scoring'] == original['scoring']
assert all(c['type'] == 'binary' and Decimal(str(c['weight'])) > 0 for c in parsed['criterion'])
payload = {'original_count': 37, 'atomic_count': len(used_ids), 'scenario_count': 37, 'total_weight': '49.5', 'total_ui_actions': None, 'total_ui_actions_note': 'Unmeasured; per-protocol figures are legacy planning estimates before shared handoffs and refinements, not a current aggregate.', 'nominal_manual_runs_before': 60, 'nominal_manual_runs_after': 50, 'mapping': mapping}
(out / 'decomposition-map.json').write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
summary = {
    'original_count': 37, 'atomic_count': len(used_ids), 'shared_scenarios': 37, 'total_weight_decimal': '49.5',
    'every_original_budget_preserved': True, 'unique_scored_evidence_keys': len(used_ids),
    'all_binary_positive_weights': True, 'judge_mcp_scoring_config_unchanged': True,
    'source_judge_sha256': hashlib.sha256((task / 'tests/scored/functional/judge.toml').read_bytes()).hexdigest(),
    'draft_judge_sha256': hashlib.sha256((draft / 'judge.toml').read_bytes()).hexdigest(),
    'draft_prompt_sha256': hashlib.sha256((draft / 'prompt.md').read_bytes()).hexdigest(),
    'legacy_per_protocol_ui_estimate_before_handoffs': sum(nominal_actions),
    'nominal_manual_runs_before': 60,
    'redundant_control_runs_removed_by_handoffs': 11,
    'new_manual_autorun_on_control': 1,
    'nominal_manual_runs_after': 50,
    'new_nominal_actions': 'CSS prior-style assertion, manual Run while Auto-run on, reverse copy independence, source-only dirty indication, lowercase/uppercase import separation; conditional case and unindent fallbacks only if needed.',
    'status': 'Review draft authored outside task; parent owns task merge. This script does not alter task files or claim browser/provider/platform validation.'
}
context_path = draft / 'app_context.md'
context = context_path.read_text(encoding='utf-8').strip()
# Text-only reproduction of installed RewardKit's _build_criteria_block; the
# independent harness performs the authoritative installed-builder/argv test.
criterion_lines = [f"- '{c['name']}': {c['description']} (score: \"yes\" or \"no\")" for c in parsed['criterion']]
criterion_lines += ['', 'Respond with a JSON object. Example:', json.dumps({c['name']: {'score': 1, 'reasoning': '...'} for c in parsed['criterion']}, indent=2)]
resolved = prompt.replace('{app_context}', context).replace('{criteria}', '\n'.join(criterion_lines))
summary['draft_context_sha256'] = hashlib.sha256(context_path.read_bytes()).hexdigest()
summary['resolved_prompt_utf8_bytes_text_reproduction'] = len(resolved.encode('utf-8'))
summary['draft_raw_prompt_file_bytes'] = len((draft / 'prompt.md').read_bytes())
assert len(resolved.encode('utf-8')) < 110000
assert 'the selection still covers' not in prompt
assert "Do not depend on another criterion's draft." not in prompt
for fixed in ('timeout-control', 'js-good-preview', 'html-good-preview', 'timer-good-preview', 'promise-good-preview', 'recovery-marker-Q7'):
    assert fixed not in prompt and fixed not in judge, fixed
assert 'Each functional criterion creates its own distinct titles' not in context
assert 'For cw_preview_network_requests_blocked,' not in prompt
assert 'This criterion' not in prompt
summary['shared_baseline_marker_and_context_checks'] = True
(out / 'draft-validation.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, indent=2))
