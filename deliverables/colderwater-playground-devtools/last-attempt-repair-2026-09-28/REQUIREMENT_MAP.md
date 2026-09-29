# Retained requirement coverage

Runtime packaging/framework declarations are checked by source/runtime audit, not inferred from a UI appearance. Removed workflows are explicitly out of the request.

| Protocol | Public requirement | Scored outcomes |
|---|---|---|
| S01 | instruction.md and overview.md: ready startup, own examples, separate saved user copy | cw_startup_ready, cw_usable_examples, cw_example_separate |
| S02 | overview.md filename dispatch; behaviour.md preview CSS copy/fresh JS | cw_js_html_filename_dispatch, cw_css_apply_snapshot, cw_extension_case, cw_js_fresh_document, cw_css_inert_copy, cw_css_pending_timer_cancelled |
| S03 | behaviour.md completed preview interactions and Stop | cw_later_interactions, cw_completed_stop |
| S04 | behaviour.md superseding/Stop and last-good rollback | cw_supersede_pending, cw_stop_pending_execution, cw_stop_pending_rollback |
| S05 | security.md parent document/storage isolation | cw_preview_origin_boundary |
| S07 | security.md snippet-only networking boundary | cw_snippet_network_boundary |
| S08 | security.md supported source/unsupported execution families | cw_harmless_scope_words, cw_unsupported_execution_refused |
| S09 | behaviour.md five-second runs, literal loops/Promise callbacks and recovery | cw_literal_loop_deadline, cw_literal_loop_rollback |
| S10 | behaviour.md JS error message/line/last-good | cw_js_error_message, cw_js_error_line, cw_js_error_rollback |
| S11 | behaviour.md complete HTML error line/last-good | cw_html_error_message, cw_html_error_line, cw_html_error_rollback |
| S12 | behaviour.md timer errors/last-good | cw_timer_error_message, cw_timer_error_line, cw_timer_error_rollback |
| S13 | behaviour.md unhandled Promise errors/last-good | cw_promise_error_message, cw_promise_error_line, cw_promise_error_rollback |
| S14 | behaviour.md four console levels/order | cw_console_level_stream |
| S15 | behaviour.md inspect objects/arrays | cw_console_value_inspection |
| S16 | behaviour.md history/Clear/duration | cw_console_history, cw_console_duration, cw_console_clear_control |
| S17 | behaviour.md Auto-run debounce/OFF/manual Run | cw_autorun_debounce, cw_autorun_off_stays_idle, cw_autorun_off_cancels_queue, cw_manual_run_independent_of_autorun |
| S19 | ui.md mono/line numbers/three syntax modes | cw_editor_monospace, cw_editor_line_numbers, cw_editor_syntax_colouring |
| S21 | behaviour.md New/Save/load exact records; integration.md reload | cw_saved_record_fidelity, cw_saved_records_browser_reload |
| S22 | integration.md process restart preserves identities/revisions | cw_process_restart_durability |
| S23 | behaviour.md stale Save refusal, dirty draft recovery | cw_stale_save_server_refusal, cw_stale_save_draft_recovery |
| S24 | behaviour.md trim/unique/nonempty/case-sensitive titles | cw_title_trimming, cw_title_collision_refusal, cw_title_empty_rejected, cw_title_case_sensitive |
| S34 | ui.md themes | cw_theme_actual_switch, cw_theme_work_preserved |
| S36 | behaviour.md scheduled callbacks share original Run budget | cw_callback_shared_run_deadline, cw_callback_timeout_rollback |

Render: basic authored preview/log execution. Constraints: independent-context server save/read. Polish: mobile usability, labels, keyboard reachability, focus, keyboard examples/library/editor route, feedback and organisation. Visual: six unchanged degree-of-quality axes.

Removed from both request and rubric: internal-file privacy classification, CSS hidden-global inspection, pane-size persistence, bracket matching/indentation shortcuts, console autoscroll, native leave warning, custom Run/Save/Clear shortcuts, separate Rename/Duplicate/Delete workflows, import/export and their validation matrix, navigation discard-warning matrix, and pending-interaction deadline nonextension. Golden extras are not mandatory.
