# Frozen Functional waits and scenario inventory

Read-only structural review of the 37 Functional rows in frozen release `5d0f1d74ae48`, using `two-findings-fix-2026-09-27/archive-check-5d0f1d74ae48/colderwater-playground-devtools/tests/scored/functional/{judge.toml,prompt.md}` and its public instructions. This is a static workload inventory, not measured runtime or a test result. No app, provider, task source, or frozen evidence was changed. The parent owns source binding and measured timings.

## Required elapsed time versus polling

Eight rows contain timed behavioral episodes. Their nominal aggregate elapsed time is about **51.05 seconds plus positive debounce/edit spans**, restart completion, and ordinary UI/tool latency. This is not a measured duration or a strict universal lower bound: the three five-second budget expirations are nominal contract times, and implementation scheduling varies. The explicitly required idle/absence windows alone exceed **36 seconds**. There are 14 timed episodes when counting the two successful Auto-run observations separately; its continuous editing span is additional active setup.

| Frozen row | Required observation on a successful setup | Accounting and purpose |
| --- | --- | --- |
| `cw_completed_preview_interactions` | At least 6 s idle after initial completion; another 6 s focused and untouched before typing | **12 s**, two consecutive intervals. Distinguishes later click/key/input from the initial five-second clock. Public contract requires later interaction; six seconds is the probe's chosen discriminating interval. |
| `fresh_cancel` | Observe until 6 s after A starts; separately observe past the stopped run's 4 s timer | **More than 10 s** from the two starts under the frozen sequence. Editing/replacement/Stop occur inside these windows. A's four-second timer is not another four-second wait. |
| `cw_execution_budget_termination` | Braced and unbraced literal loops each reach the five-second budget | **About 10 s**, two episodes. The approximately eight-second limit is scheduling tolerance, not an instruction to sleep eight seconds after termination. |
| `cw_timer_error_line_and_preview_restore` | Authored timer throws after 50 ms | **0.05 s nominal**, one event-driven interval; observe the callback/error, not an arbitrary extra sleep. |
| `auto_run` | Observe first debounce; continue edits beyond the first would-run time; observe final debounce; then observe two off/cancel windows | Let delays be `d1`, `d2`, edit span `S > d1`, and `W = max(3 s, max(d1,d2) + 1 s)`. Cost is at least **`d1 + S + d2 + 2W`**. The fixed negative windows contribute at least **6 s**. Batch edits rather than letting evaluator round trips become idle gaps. |
| `cw_supported_source_file_import` | Imported source stays unrun for 2 s with Auto-run off | **2 s**, then Run. This establishes absence of premature execution; it is not download/upload polling. |
| `cw_shared_run_deadline_recovery` | Callback starts after 4 s; its loop expires on the original Run's five-second clock | **About 5 s total**, not 4 + 5. The approximately eight-second allowance is an observation cutoff, not an additional wait. |
| `cw_pending_interaction_budget_nonextension` | Attempt further input about 2 s after Start; observe expiry and continue beyond the original 6 s timer | **More than 6 s total**, not 2 + 5 + 6. The second input is an offset inside the original episode. Await the actual timeout result if it arrives later within allowed overhead. |

The other 29 rows have no prescribed fixed elapsed interval. Restart requires waiting for the one restart operation to complete, without a contractual number of seconds. Successful Run completion, downloads, API responses, Promise rejection, browser navigation, and framework rendering should be observed with bounded event/condition waits. They do not justify blanket sleeps. The network control's five-second abort timers are failure guards, not mandatory waits after successful local fulfillment. Browser automation timeouts after a dismissed native leave dialog are tool behavior, not a required product wait. Setup retries are conditional additional cost and are excluded here.

The public contract supplies the five-second budget and approximately two-second Auto-run responsiveness target. Most exact six-, four-, three-, two-second and 50 ms intervals above are verifier choices needed to expose the targeted behavior. A rewritten scenario may change a probe while retaining its distinguishing power; it must not silently shorten the original budget, give callbacks a new clock, or stop observing before a canceled callback could fire.

## Conservative operation floor

For the complete successful evidence path, the frozen rows require at least **60 explicit manual Run activations and 54 record-mutation attempts**, or **114 central UI/API actions**. Adding the nine required working-file browser navigations gives **at least 123 major product actions, plus one real process restart**. There are also at least two successful automatic executions in `auto_run`; example selection/startup may execute automatically too.

This deliberately undercounts total work. A mutation attempt includes a Save, rename, duplicate, deletion, or otherwise-valid negative write submission, whether triggered by UI or an observed-shape in-page request. A UI action and its resulting request count once; a rejected attempt still counts. These are semantic product operations, **not Playwright calls or a promised HTTP request count**. Proactive UI rejection can require an additional server probe. Source/title/filename edits, New actions, loads, ordinary page opens/reloads, all snapshots/fresh reads, dialog responses, preview clicks/typing, import/export, route-control requests, scrolling, pane/theme controls, and cleanup are excluded from this floor. Zero in a table cell therefore does not mean a row requires no interaction.

| # | Frozen criterion | Manual Runs | Record-mutation attempts |
| --- | --- | ---: | ---: |
| 1 | `initial_examples` | 1 | 1 |
| 2 | `language_dispatch` | 4 | 0 |
| 3 | `cw_completed_preview_interactions` | 2 | 0 |
| 4 | `fresh_cancel` | 5 | 0 |
| 5 | `cw_preview_origin_isolation` | 3 | 0 |
| 6 | `cw_runtime_files_not_publicly_exposed` | 2 | 0 |
| 7 | `cw_preview_network_requests_blocked` | 4 | 0 |
| 8 | `cw_unsupported_execution_refusal` | 7 | 0 |
| 9 | `cw_execution_budget_termination` | 4 | 0 |
| 10 | `cw_js_error_line_and_preview_restore` | 3 | 0 |
| 11 | `cw_html_error_document_line_and_preview_restore` | 3 | 0 |
| 12 | `cw_timer_error_line_and_preview_restore` | 3 | 0 |
| 13 | `cw_promise_rejection_line_and_preview_restore` | 3 | 0 |
| 14 | `console_levels` | 1 | 0 |
| 15 | `console_objects` | 1 | 0 |
| 16 | `console_controls` | 3 | 0 |
| 17 | `auto_run` | 2 | 0 |
| 18 | `pane_resize` | 0 | 0 |
| 19 | `editor_basics` | 0 | 0 |
| 20 | `editor_indent` | 0 | 0 |
| 21 | `save_load` | 0 | 2 |
| 22 | `cw_process_restart_durability` | 0 | 4 |
| 23 | `persistent_snippets` | 0 | 4 |
| 24 | `cw_title_change_uniqueness` | 0 | 9 |
| 25 | `cw_stale_rename_preserves_newer_record` | 0 | 4 |
| 26 | `cw_independent_snippet_copy` | 0 | 5 |
| 27 | `delete_confirm` | 0 | 3 |
| 28 | `cw_stale_delete_preserves_newer_record` | 0 | 7 |
| 29 | `cw_deleted_identity_rejects_update` | 0 | 6 |
| 30 | `cw_dirty_workspace_transition_warnings` | 0 | 2 |
| 31 | `cw_native_dirty_leave_warning` | 0 | 1 |
| 32 | `cw_exact_source_file_export` | 0 | 0 |
| 33 | `cw_supported_source_file_import` | 2 | 5 |
| 34 | `cw_theme_switch_legibility` | 1 | 0 |
| 35 | `cw_keyboard_shortcut_actions` | 1 | 1 |
| 36 | `cw_shared_run_deadline_recovery` | 3 | 0 |
| 37 | `cw_pending_interaction_budget_nonextension` | 2 | 0 |
| **Total** | | **60** | **54** |

The title row's nine attempts are three creates, two valid renames, and four invalid-title attempts. Restart's four writes are two independent creates and pre/post-restart updates. Import's five are control save, imported save, two server filename probes, and edited-source save. Only one authored Run is unconditionally manual in `initial_examples`; its selected example may execute without a Run click. The floor excludes conditional retries and any extra operation needed to recover from a defect. Ordinary failures may shorten the frozen conjunction path; that does not represent the work needed to observe all independently creditable features.

## Proposed shared scenario order for a rewritten evaluator

The frozen prompt requires row order and each row's own evidence, so the following is a proposal for the parent's rewrite, not permission to reinterpret the frozen results. Shared setup is allowed only after the rewritten grading contract is finalized and frozen; the `5d0f` order and own-control instructions remain binding for that release. Use an evidence ledger of observed facts, exact source/fields, identities, current revisions and timestamps. Several criteria may consume the same observation when it directly proves each fact; they must not consume another criterion's verdict. After a failed feature, use a simple successful fallback setup for unrelated observations instead of skipping the rest of the scenario.

This primary-scenario mapping assigns all 37 frozen IDs exactly once. Reuse of evidence across scenarios does not move or duplicate ownership. These IDs describe the source inventory, not proposed final IDs for the rewritten rubric.

| Scenario | Primary frozen IDs |
| --- | --- |
| 1. Workspace, editor and console (9) | `initial_examples`, `console_levels`, `console_objects`, `console_controls`, `pane_resize`, `editor_basics`, `editor_indent`, `cw_theme_switch_legibility`, `cw_keyboard_shortcut_actions` |
| 2. Basic save/load, early restart and live concurrent edits (3) | `save_load`, `cw_process_restart_durability`, `persistent_snippets` |
| 3. Dispatch and completed-preview lifecycle (3) | `language_dispatch`, `cw_completed_preview_interactions`, `cw_pending_interaction_budget_nonextension` |
| 4. Runtime failures, cancellation and budgets (8) | `fresh_cancel`, `cw_unsupported_execution_refusal`, `cw_execution_budget_termination`, `cw_js_error_line_and_preview_restore`, `cw_html_error_document_line_and_preview_restore`, `cw_timer_error_line_and_preview_restore`, `cw_promise_rejection_line_and_preview_restore`, `cw_shared_run_deadline_recovery` |
| 5. Auto-run and source files (3) | `auto_run`, `cw_exact_source_file_export`, `cw_supported_source_file_import` |
| 6. Saved-record rules and ordinary CRUD (6) | `cw_title_change_uniqueness`, `cw_stale_rename_preserves_newer_record`, `cw_independent_snippet_copy`, `delete_confirm`, `cw_stale_delete_preserves_newer_record`, `cw_deleted_identity_rejects_update` |
| 7. Dirty transitions, native warning and boundaries (5) | `cw_dirty_workspace_transition_warnings`, `cw_native_dirty_leave_warning`, `cw_preview_origin_isolation`, `cw_runtime_files_not_publicly_exposed`, `cw_preview_network_requests_blocked` |

| Order | Shared scenario | Reuse and separation |
| --- | --- | --- |
| 1 | Startup, ordinary execution, editor and console | Capture startup/example evidence before editing. One authored working snippet can populate DOM, ordered levels, inspectable data and console rows. Inspect highlighting while later changing language filenames. Test scroll behavior with later appended marker Runs. Theme/pane checks preserve this known state. Record button and shortcut outcomes separately; if a shortcut fails, manual setup keeps unrelated checks possible. Defer saved-example and Save-shortcut legs until after the early restart, while retaining this scenario's primary ownership of their facts. |
| 2 | Basic save/load, one early restart, then live concurrent edits | Establish the basic independent New/Save pair and browser-reload observations, then perform the one restart immediately after basic save/load and before broader library mutation workflows. Keep restart controls established solely by New/Save, with a pre-restart update, exact snapshot and post-restart reads/update. No Duplicate, Delete, import or shortcut is a prerequisite. Then use two actual live editors for dirty conflict retention/recovery. |
| 3 | Filename dispatch and completed-preview lifecycle | Follow JS to complete HTML to CSS to fresh JS. A live HTML handler is the CSS-removal control and can supply later-interaction observations before CSS replacement. Keep Stop and pending-timeout probes in independently re-established contexts because either can destroy handlers. Score dispatch, CSS styling/copying, handler/global isolation, later interaction and stopping as separate facts. |
| 4 | Runtime failure, cancellation and budgets | Chain each successful recovery into the next probe's known-good baseline. Preserve exact source lines for each error. Keep each unsupported family, each error family and each literal-loop form separately observable. Do not combine sources when the first throw/refusal would prevent later probes. Cancellation/timeout windows remain tied to their actual start events. |
| 5 | Auto-run, source-file UI and export | Measure debounce once, use its measured window for both negative observations, then leave Auto-run off. Reuse a stable preview for the import nonexecution window. Capture exact import and export data separately. Server filename validation gets its own saved valid-record control even if import UI fails. |
| 6 | Saved-record rules and ordinary CRUD | Create a small set of dedicated records, recording real operation shapes and exact snapshots once. Reuse current reads where directly valid. Complete any deferred saved-example and Save-shortcut observations here. Separate ordinary rename, trimming, exact collision refusal, case distinction, empty titles, independent copy, normal deletion and each server protection. Refresh revisions after every actual mutation; a failed refusal must not turn the next probe into an accidental stale request. |
| 7 | Dirty transitions, native warning and final boundaries | Reuse clean saved baseline/destination records, rebuilding the exact dirty draft before each attempted transition. Keep browser-native leave behavior separate from in-app warnings. Group bounded privacy paths and locally fulfilled fetch/image probes around a real working execution control; remove only the probe routes/pages afterward. Never use a missing output or a guessed endpoint as a successful refusal. |

A concrete reduction is possible in the four error rows: their frozen pattern is four times `(good control, failing source, successful recovery)` = **12 Runs**. A ledger-backed chain with one initial good control and four `(failure, recovery)` pairs needs **9 Runs**, while each row still has an actually observed preceding good state, exact failure and recovery. Re-establish a working baseline if any recovery fails. This example is a structural opportunity, not a measured saving or an instruction to change the frozen rules.

Batch time-sensitive browser actions and their timestamps into a bounded call. Event-based observation avoids idle tool round trips, but batching does not reduce the number of product behaviors required. Passive inspections can occupy an existing timed window only if they do not change its focus, preview, draft, pending work or observable state. Do not run competing timeout/cancellation experiments concurrently in the same workspace.

## Independent partial-feature grading examples

| Partial implementation | Facts that should retain credit when directly observed | Separately failed fact and alternate setup |
| --- | --- | --- |
| Import UI works; server accepts bad saved filenames | Exact supported-file transfer, editable draft, two-second nonexecution, later manual execution, and UI unsupported-import refusal can each succeed. Supported imported saving can also succeed. | Server refusal of `unsupported.txt` and `nested/demo.js` must be judged separately. Use a normal New/Save valid record if import fails; use current revisions and fresh exact reads for each server probe. An accepted invalid write fails that validation fact, not observed import behavior. |
| Padded titles trim correctly; uniqueness is incorrectly case-insensitive | Padded create and rename trim to exact expected titles; ordinary rename preserves identity/other fields; exact and padded exact collisions may be correctly refused. | Ability to coexist as `Sketch` and `sketch` is a separate required success, so case-insensitive rejection fails that fact alone. Use unrelated names for trimming controls so the case-distinction defect cannot prevent them. Empty/whitespace rejection and stale rename remain distinct observations. |
| Filename extension dispatch works; CSS retains old event handlers | Case-insensitive JS/HTML/CSS selection, authored output, CSS application to copied DOM, and fresh JS replacement can be observed independently. | Inherited CSS handler removal fails if a formerly working handler fires after copying. Script rerun and global isolation are separately observable too. Establish a real live handler before the CSS probe; if it never worked, absence afterward cannot earn isolation credit. A `.js`-created DOM/handler control can isolate copying from a broken HTML parser where the public behavior permits it. |

The same principle applies to message versus line attribution, basic import versus server storage rules, and normal confirmation versus server stale/deleted protections: shared setup may be efficient, but a single binary conjunction should not erase directly observed independent successes. If a malformed request unexpectedly mutates a dedicated probe record, record that defect, reread its actual revision/state, and restore valid fixture data through ordinary supported operations or create another valid record before the next independent probe. Do not repair the app, guess routes, or count an unrelated rejection as success.
