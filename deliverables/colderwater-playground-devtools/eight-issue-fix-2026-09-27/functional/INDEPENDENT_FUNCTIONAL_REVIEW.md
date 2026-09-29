# Independent Functional and browser-probe review

Scope: the current top-level request, all six public notes, all 35 Functional descriptors, the Functional prompt, shared app context and affected Polish keyboard descriptor. This is a review of the revised source and browser feasibility; it is not a paid judge run.

## Findings resolved during this review

- Host responsiveness during a running infinite loop was not in the public brief. The revised check owns timely termination and actual usability afterward.
- Language handling and completed-preview delayed interactions are now independently scored, with their own fixtures. Original-run deadlines and nonextension of pending interaction deadlines are likewise independent. Their combined mass remains 5.0.
- The auto-run OFF/cancellation observation window now extends beyond the actual observed debounce, with a margin and successful manual followups.
- Stale-save scoring now uses an actual dirty second editor. Server-only stale rename/delete replay remains allowed, without claiming a replay proved UI draft retention.
- Runtime privacy no longer asks the judge to classify implementation text or database bytes. The public note explicitly reserves the three named addresses; the check observes denial, working workspace fallback or download. The initially enumerated denial statuses were changed to examples so an equivalent clear denial can also pass.
- The binary output placeholder was corrected from RewardKit's serialized `raw` field to the actual judge output field `score: "no"`. Only structured evaluator-owned reasoning may begin with the incomplete-evaluation marker.
- The restart check moved to position 22, immediately after basic save/load, and uses its own controls. It is no longer always last.
- Polish now explicitly accepts ordinary/native Escape-then-Tab without requiring an application help hint.

No remaining concrete mismatch was found in this scoped source review. The timing concern remains an explicitly unmeasured limit: the full provider-driven 35-criterion session has not been timed. Moving restart and reducing custom setup are useful repairs, not proof of a universal 9,000-second upper bound.

## Requirement ownership

All 35 checks are listed in `TIMING_AND_COVERAGE_LEDGER.md`. The mapping below records the public sources and the separation of outcomes.

| Public note and requirement | Functional owners |
|---|---|
| overview: useful opening example, authored result, filename-driven JS/HTML/CSS | initial_examples, language_dispatch |
| behaviour / preview: fresh execution contexts, CSS static copy without old handlers | language_dispatch |
| behaviour / preview: a completed preview remains interactive after its original deadline | cw_completed_preview_interactions |
| behaviour / preview: replace/Stop pending work, preserve last good output and explain Stop | fresh_cancel |
| security: parent document and storage isolation | cw_preview_origin_isolation |
| security: three reserved runtime URLs denied or return to workspace | cw_runtime_files_not_publicly_exposed |
| security: authored snippets cannot fetch external resources; app CDN assets allowed | cw_preview_network_requests_blocked; app-wide bans explicitly excluded |
| security: refuse eval, Function, WebAssembly, additional workers and dynamic imports without blocking harmless words | cw_unsupported_execution_refusal |
| behaviour: supported literal loops terminate and editor recovers | cw_execution_budget_termination |
| behaviour: original run and scheduled callbacks share one budget | cw_shared_run_deadline_recovery |
| behaviour: pending interaction's deadline cannot be extended by another click | cw_pending_interaction_budget_nonextension |
| behaviour: actual source lines and good-preview restoration for sync JS, full HTML, timer error and unhandled rejection | Four separate error-line/restoration criteria |
| behaviour / console: ordered levels, inspectable values, duration, scroll-follow and Clear | console_levels, console_objects, console_controls |
| behaviour / automatic runs: pause/reset, OFF, cancel pending request, manual Run | auto_run |
| ui: movable persistent pane allocations | pane_resize |
| ui: monospaced syntax editor, line numbers, bracket match, reversible multiline indentation | editor_basics, editor_indent |
| overview / saved snippets: independent saved records, exact reload, identity/revision durability across actual restart | save_load, cw_process_restart_durability |
| behaviour / saved snippets: stale-save refusal, retained real draft and deliberate successful recovery | persistent_snippets |
| behaviour / saved snippets: trimmed case-sensitive title uniqueness and invalid-title rejection | cw_title_change_uniqueness |
| behaviour / saved snippets: stale rename cannot replace newer fields/revision | cw_stale_rename_preserves_newer_record |
| behaviour / saved snippets: duplicate identity and independent edits; name collision safety | cw_independent_snippet_copy |
| behaviour / saved snippets: delete confirmation, stale-delete safety, no recreation of deleted identity | delete_confirm |
| behaviour / unsaved work: actual cancel/accept protection for four replacement actions and native browser leave | cw_dirty_workspace_transition_warnings, cw_native_dirty_leave_warning |
| behaviour / files: exact export; supported import, no surprise execution, server-side filename validation | cw_exact_source_file_export, cw_supported_source_file_import |
| ui: switching themes preserves existing work; documented Run/Save/Clear shortcuts work | cw_theme_switch_legibility, cw_keyboard_shortcut_actions |

Keyboard navigation and general layout remain Polish concerns; Visual owns the aesthetic anchors. The revised Functional criteria do not add an unrequested binding, UI layout, indentation width, status-code spelling, backend route shape or application framework inspection. Exact source and expected output are probe data derived from the stated behaviors.

## Actual browser evidence

`browser_probe_results.json` records **15/15 passed groups** using the installed Playwright MCP 0.0.79 and Chromium 152 in a disposable container with networking disabled. It includes:

- The three exact supplied network recipe blocks, extracted from the current prompt and executed without modification across separate MCP calls.
- Two locally fulfilled positive resources, then actual golden UI runs that refuse fetch and image loading with visible warnings and no extra deliveries, followed by a successful ordinary run.
- The exact returned sources executed in a deliberately unrestricted control page, which produces both expected outputs and raises deliveries from 2 to 4. This is a synthetic source-execution control, not a full alternate application.
- Cleanup of the exact route handlers and removal of their bookkeeping.
- Actual golden 404 responses at all three reserved URLs and successful ordinary execution afterward.
- Eighteen synthetic URL observations: the three addresses under 404, 403, actual working SPA fallback, redirect to the working workspace, a harmless synthetic download, and a different public text file. The first four modes meet the public contract; the last two are correctly detected as violations. No implementation body or database content is inspected for a verdict.

`opaque_frame_probe_results.json` adds **3/3 passed groups**: exact setup, the exact authored sources running in a mounted opaque sandboxed iframe with deliveries 2 → 4, and exact cleanup. Thus the tested route counter observes both ordinary pages and mounted opaque frames.

Both reports bind task/golden file hashes and tool versions. These are deterministic tool-execution observations and local golden checks, not Oracle scoring.

## Retained exploratory failures

The attempts are preserved rather than relabelled as passes:

- Attempts 1–2 constructed an inline synthetic iframe script before its body existed. That invalid fixture raised an appendChild error and did not establish the intended unrestricted control. It was replaced with a ready about:blank page and separately checked in an already-mounted opaque frame.
- Attempt 3 actively cancelled a synthetic download and conflicted with the MCP tool's own download bookkeeping. The event observer was changed to avoid that cancellation.
- Attempt 4 closed its probe page before the asynchronous download event had arrived. The final fixture arms `waitForEvent('download')` before navigation and awaits that actual event before closing the page. The navigation exception alone is not used as the product verdict.

These were evidence-script setup defects. They did not require app changes, did not show a golden behavior failure and were not used as passing evidence. The corrected full proof is the final `browser_probe_results.json`.

## Remaining limits

No local script can guarantee that a subjective platform reviewer will raise no further issue. Browser probes are representative checks, not a proof against every possible implementation or exposure URL. Framework/SQLite architecture cannot be proved solely from rendered behavior; source-level implementation review and runtime contract validation remain separate evidence. Hosted provider timing, a fresh platform QC acceptance and Oracle 1.0 are unmeasured.
