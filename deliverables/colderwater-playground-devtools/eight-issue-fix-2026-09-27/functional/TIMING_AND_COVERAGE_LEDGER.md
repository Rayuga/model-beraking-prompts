# Functional work and timing ledger

This is a planning ledger derived from the listed actions, not a measurement of a hosted LLM judge. A criterion's numbered legs are not equivalent to model turns or tool calls. The 9,000-second Functional budget remains unchanged. Actual end-to-end provider latency, the judge's reasoning time and its handling of an unfamiliar UI have not been measured here.

The revised suite contains 35 criteria. The separate public requirements introduced by prior changes already existed; the two splits allocate their credit independently rather than adding new product behavior. The original recovery chain's save/reload setup was removed because persistence has dedicated coverage. The restart check is moved immediately after `save_load` (position 22), with its own durable controls and no dependency on a prior verdict, so it is no longer always the final work at risk.

| Order | Criterion | Product behavior / core action groups | Intentional timing beyond ordinary UI completion |
|---:|---|---|---|
| 1 | initial_examples | Automatic working opening state, selectable example, own authored output | None fixed |
| 2 | language_dispatch | JS → full HTML → CSS copy → fresh JS; observe handler removal | None fixed; immediate handler is only CSS setup |
| 3 | cw_completed_preview_interactions | Own complete HTML, delayed click, delayed focused keyboard/input | Two separate six-second waits |
| 4 | fresh_cancel | Own good control, replace still-pending run, Stop separate run, recovery | Observe six seconds from A start; separately past Stop candidate's four-second timer |
| 5 | cw_preview_origin_isolation | Parent document/storage guards, unchanged host state, successful own-document controls | None fixed |
| 6 | cw_runtime_files_not_publicly_exposed | Own control, three named reserved URL probes, ordinary recovery | Bounded browser navigation/HTTP observations; no judge-written file classifier |
| 7 | cw_preview_network_requests_blocked | Tool-controlled text/image positive control, two separate authored denied requests, successful ordinary control | Bounded deterministic locally fulfilled requests; no internet latency needed |
| 8 | cw_unsupported_execution_refusal | Harmless-word positive control, five separately refused unsupported execution families, recovery | None fixed; bounded sources only |
| 9 | cw_execution_budget_termination | Own good control, braced infinite loop, unbraced infinite loop, actual recovery | Two five-second deadlines, each observed with up to about eight seconds scheduling tolerance |
| 10 | cw_js_error_line_and_preview_restore | Own good preview, exact four-line JS failure, correct user line, recovery | None fixed |
| 11 | cw_html_error_document_line_and_preview_restore | Own good preview, exact nine-line HTML failure, document line, recovery | None fixed |
| 12 | cw_timer_error_line_and_preview_restore | Own good preview, exact two-line timer failure, line and recovery | 50 ms callback |
| 13 | cw_promise_rejection_line_and_preview_restore | Own good preview, unhandled rejection, exact source line, recovery | Ordinary Promise/error event delivery |
| 14 | console_levels | One run produces ordered log/warn/error/info | None fixed |
| 15 | console_objects | One run, inspect nested object and array values | None fixed |
| 16 | console_controls | Forty rows, hold scrolled position, follow bottom, clear and duration | None fixed |
| 17 | auto_run | Positive measured debounce, reset on typing, OFF hold, pending cancellation, manual followups | Two successful short debounce periods; two windows max(3 s, observed debounce + 1 s) |
| 18 | pane_resize | Resize two allocations, reload, preserve sizes | None fixed |
| 19 | editor_basics | Line numbers, three syntax modes, matching bracket | None fixed |
| 20 | editor_indent | Multiline Tab followed by Shift+Tab exact reversal | None fixed |
| 21 | save_load | Two distinct saves, both load, reload, both persist | None fixed |
| 22 | cw_process_restart_durability | Own primary/copy/deleted controls, one real process restart, exact persisted fields/revisions, valid later save | One bounded restart tool call plus readiness wait; measured separately by harness |
| 23 | persistent_snippets | Two actual dirty/live editors; A save, B conflict, retained draft, server no mutation, deliberate recovery | None fixed; no request-only substitute for UI evidence |
| 24 | cw_title_change_uniqueness | Valid rename; exact/trimmed/empty collisions refused; case-sensitive coexistence; valid recovery | None fixed |
| 25 | cw_stale_rename_preserves_newer_record | Own record, real newer rename, stale refusal, exact server fields, later successful rename | None fixed |
| 26 | cw_independent_snippet_copy | Independent duplicate identities and later edits, duplicate collision refusal, valid duplicate recovery | None fixed |
| 27 | delete_confirm | Cancel delete, valid control, stale delete refusal, valid current delete, prevent stale recreation | None fixed |
| 28 | cw_dirty_workspace_transition_warnings | Own saved controls; four replacement actions cancel/accept; title-only and filename-only dirty cases | None fixed |
| 29 | cw_native_dirty_leave_warning | Clean reload; actual keyboard dirty edit; native leave cancel/accept; unchanged saved record | Bounded native dialog handling, not a sleep |
| 30 | cw_exact_source_file_export | Actual browser download filename and exact source | Download completion, no fixed delay |
| 31 | cw_supported_source_file_import | Own good control, supported import not executed while OFF, explicit Run, save/load, invalid file/server refusals, valid save | Two-second hold with Auto-run off; no auto-run debounce is pending |
| 32 | cw_theme_switch_legibility | Own working preview; two actual theme switches preserving source and output | None fixed |
| 33 | cw_keyboard_shortcut_actions | Documented Run/Save/Clear shortcuts cause real outputs and saved record | None fixed |
| 34 | cw_shared_run_deadline_recovery | Own successful control, four-second timer then literal loop, original shared deadline and recovery | Original-run termination by about eight seconds; not a new five seconds at callback entry |
| 35 | cw_pending_interaction_budget_nonextension | Own HTML control, six-second pending work, second click at two seconds, unchanged deadline, rollback and recovery | Observe until after six-second callback's scheduled time and termination by about eight seconds |

The deliberately requested timed waits, excluding ordinary browser completion, tool setup and process restart, are approximately a minute: 12 seconds for delayed interactions; about 10 for cancellation witnesses; up to 16 for the two literal loops; roughly 10 for debounce successes and negative windows; 2 for import; 8 for the original shared deadline; and 8 for pending interaction nonextension. These overlap within their respective workflows and are not a measured suite duration. The predominant unknown is the judge's action and reasoning overhead, not the explicit sleeps.

Budget reduction comes from a concrete controlled probe recipe, no source-code/private-file classifier, bounded setup retries, removal of duplicate recovery saves/reloads, and moving restart earlier. These changes address causes of avoidable work. They do not by themselves prove that every hosted run will finish within 9,000 seconds. Keep that limitation visible until a representative full judge run is measured; never use an unobserved performance assumption as a passing result.
