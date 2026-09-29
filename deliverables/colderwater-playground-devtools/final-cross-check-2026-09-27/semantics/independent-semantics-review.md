# Independent semantics cross-check of the requested candidate

Reviewed ZIP: `eight-issue-fix-2026-09-27/colderwater-playground-devtools.zip`, SHA-256 `a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1`.

This began as a read-only adversarial review of that snapshot. It is not a platform result, a golden-app verdict, or a guarantee that all valid alternatives pass. After receiving the findings, the parent reviewer explicitly authorized the narrow grading-text repairs recorded in the final section. Source implementation, public notes, user preview, and submitted application state were not modified by this sub-review. No provider calls or platform runs were made. Implementation source was not used as scoring evidence.

Read in order: public brief and all six notes; all 35 Functional descriptors; all five judge prompts and shared context; the local QC skill and its three references. The workbook's 53 quality checks and 48 deterministic check definitions were read, including its internal interpretation sheet, and enumerated with the supplied script using the workspace Python. This bounded sub-review does not claim to execute all 101 checks; full mechanical and reference-runtime review belong to the parent review. Internal workbook annotations are not reproduced here.

All paths and line numbers below are relative to the original task root in the named ZIP. Runtime verdict for each proposed witness is **NOT EXERCISED**. A static textual contradiction or omitted fixture is distinguished from an observed application defect.

## Prioritized findings

### S1 — P1 / fairness: pending-interaction fixture requires provisional DOM visibility

Public requirement: `environment/instructions/behaviour.md:13` says, "It's fine to show a run's candidate preview while it works," then applies the same success/rollback rule to interactions. This permits holding the last successful visible render until work successfully commits.

The original `tests/scored/functional/judge.toml:510` requires: "Confirm interaction-candidate and interaction-started while the timer is pending." `interaction-candidate` is the provisional paragraph produced inside the handler. The shared-run check at line 496 also says "confirm the candidate is active while the timer is pending," which can ambiguously be read as requiring a visible candidate. The global conjunction instruction at `tests/scored/functional/prompt.md:13` turns these setup observations into full-credit requirements.

**Valid implementation witness:** On interaction start, retain the successful render as a visual overlay, run the isolated candidate underneath it, capture the `interaction-started` log, and start one five-second deadline. On success, publish the candidate; on timeout, remove it and retain the prior render. This correctly hides half-finished changes, restores the correct snapshot, and never emits the six-second late marker. Nevertheless the fixture cannot observe `interaction-candidate`.

**Expected wrong grade:** `cw_pending_interaction_budget_nonextension` can fail despite correct deadline and rollback behavior. The original shared-run wording has the same risk if "active" is interpreted visually.

**Repair:** Explicitly allow the last-good render to remain visible; prove the work started and remained pending from the authored start log and normal run/interaction state, and require correct final rollback/retention and recovery, not visible provisional DOM.

This is a static fairness issue, not a claim about the reference's display policy. The parent reviewer was notified before finishing the report.

### S2 — P2 / ambiguous fairness: the second pending click is required to execute a handler

`tests/scored/functional/judge.toml:510` says to click Still waiting and "observe interaction-still-waiting." `environment/instructions/behaviour.md:11` requires further clicks or typing not to extend a pending deadline, but does not explicitly require a second handler to execute while work is pending.

**Valid alternative reading/witness:** A transactional preview ignores or temporarily disables additional preview input during a pending asynchronous interaction. It accepts later interactions again after success; this fixture times out the original interaction at five seconds and rolls back. No second input grants more time, but no `interaction-still-waiting` log is produced.

**Risk:** The descriptor treats refusal to dispatch concurrent input as a failed deadline rule. The public interactivity wording is broad enough that the intended input policy should be made explicit instead of silently selected by the rubric.

**Repair:** Attempt the second input while independently proven pending; accept either dispatch or temporary prevention, then verify it did not prolong the original budget. If concurrent event processing is truly intended as a product requirement, state it publicly first.

### S3 — P2 / coverage: successful trimming of a unique title is untested

`environment/instructions/behaviour.md:27`: "Trim spaces at their edges and keep them unique." The only padded title in `cw_title_change_uniqueness` is the collision attempt at `tests/scored/functional/judge.toml:369`. Successful creation/renaming in lines 366–367 and recovery in line 372 all use titles with no surrounding spaces.

**Wrong implementation witness:** Maintain `uniqueKey = inputTitle.trim()` for collision checking but store/display `title = inputTitle` without trimming. Every current title fixture passes: empty/whitespace-only values are rejected, padded duplicates collide, case-distinct titles coexist, and ordinary titles save. A new title `  Independent Trim Example  ` remains padded after reload, violating the public rule.

**Repair:** Create and rename using unused padded titles, then check exact trimmed stored/displayed title, unchanged other fields, and valid revisions. This can replace existing successful inputs; no extra criterion is necessary.

### S4 — P2 / coverage: rollback never proves preservation of an earlier successful interaction

`environment/instructions/behaviour.md:13` requires restoring "how the preview looked before that interaction." The completed interaction fixture (`tests/scored/functional/judge.toml:62–66`) logs but does not successfully modify the rendered state. The pending interaction fixture (`508–511`) starts its failure from the original Run render, so rollback to that original render satisfies it.

**Wrong implementation witness:** Snapshot the DOM only when the original Run completes. Allow successful handlers to mutate the live document, but on any later interaction failure always restore the original Run snapshot. It passes the current completed-interaction and timeout fixtures. A successful increment from 0 to 1 followed by a failing increment incorrectly restores 0 rather than 1.

**Repair:** Before the pending failure, complete one DOM-changing interaction and explicitly observe its success; make the subsequent timeout restore that committed state. A single added button/action in the existing fixture establishes the missing invariant.

### S5 — P2 / coverage: Stop is exercised only during an active Run

`environment/instructions/behaviour.md:11` says a successfully completed preview stays interactive "until I stop it" and stopped previews must not resume. `fresh_cancel` at `tests/scored/functional/judge.toml:85–86` stops an active timer run. The completed-preview interaction fixture at lines 62–66 never presses Stop after completion.

**Wrong implementation witness:** Disable/no-op Stop as soon as a Run reports success, while leaving that preview's event handlers alive. Later clicks still work; active timer cancellation works. All existing fixtures can pass, but the user cannot stop a completed interactive preview.

**Repair:** After proving delayed click and keyboard/input handlers work in `cw_completed_preview_interactions`, Stop that completed preview, attempt the same interactions, and confirm stopped feedback/no fresh handler output, followed by an ordinary recovery Run.

### S6 — P2 / coverage: example templates need not remain separate from saved records under the current fixtures

`environment/instructions/overview.md:9`: examples "are separate from saved user records." `initial_examples` at `tests/scored/functional/judge.toml:29–31` selects/runs an example and expressly prohibits saving during the criterion. Subsequent saved writes use dedicated new drafts. The dirty-transition example leg replaces a draft but never saves changes to the selected example.

**Wrong implementation witness:** Populate normal mutable saved rows as the examples, and load their saved identities when a user selects them. Editing and pressing Save then permanently rewrites the built-in example. Selecting/running examples and every dedicated-new-draft library fixture still work.

**Repair:** In one bounded example/library flow, save an edited example as user work and verify the built-in example still reloads its original source and remains distinct from the saved record. This is a coverage improvement, not evidence that the shipped reference fails.

## Reserved-URL privacy check

The new public contract in `environment/instructions/security.md:11` explicitly reserves all three probed URLs. That removes the old potential hidden requirement that these exact paths be private regardless of arbitrary public asset naming. `tests/scored/functional/judge.toml:114–117` has a meaningful own-document execution control, tests all three paths, permits missing/blocked outcomes, redirects, SPA fallback, equivalent denial, and reproducible refusal with a healthy workspace. It does not demand a particular framework, content type, or error text. The source-reading ban in Functional prompt line 7 is explicit.

**No ordinary valid implementation counterexample was established for the three reserved paths.** A legitimate public bundle under `/assets/...`, a 403/404, a redirect, or working SPA fallback is expressly accepted. A broken server alone cannot pass because of the positive controls. Browser setup failure is routed to the incomplete-evaluation protocol.

Two edge observations are **optional hardening/limitations**, not claimed delivery blockers:

- The sentence "A download ... does not meet" can conflict with a genuine missing/denied HTTP status accompanied by an attachment disposition containing only harmless denial text. Public wording accepts a missing/blocked response. It would be cleaner to make established denial take precedence over a generic download event. This unusual alternative was not run and is not promoted to a material finding.
- Status-only denial cannot prove the absence of secret bytes in an intentionally misleading error response. The rubric forbids classifying response bodies, and explicitly limits the test to these reserved URLs. Do not portray a pass as a complete confidentiality proof or silently reintroduce implementation-source reading to close that gap. This is a boundary of the chosen evidence policy.

## Shared-deadline semantics and setup dependence

The original Run probe uses a four-second callback followed by a literal loop (`judge.toml:493–498`). Under normal timely scheduling, a correct shared five-second budget halts around five seconds from Run; an implementation that grants a fresh five seconds at callback entry lasts about nine. Measuring from the actual Run action and forbidding a shorter callback are useful. The pending interaction probe uses a six-second callback plus input after about two seconds, so a reset deadline admits a forbidden callback whereas the correct original deadline cancels it. These check distinct phases and are not duplicate scoring merely because both concern budgets.

**Residual setup assumption:** The four-second callback must actually start before the five-second budget expires. A browser scheduling stall or a runner startup consuming over a second can produce a correct timeout before `late-callback-entered`; the fixture currently requires that log. This was not observed on the assigned candidate. Treat it as a P3 robustness note: retry a proven scheduling-miss setup once and distinguish inability to establish this timing witness from demonstrated deadline reset. Do not accept a product that generally refuses supported timers or source as a successful substitute.

The eight-second observation allowance deliberately tolerates scheduling overhead; it does not establish millisecond-accurate five-second enforcement. That is a precision limitation, not a newly discovered contradiction.

## Coverage and independence sweep of all 35 Functional criteria

"No additional issue found" below means static review found no further concrete valid/wrong witness beyond the noted findings. It is not a runtime Pass.

| # | Criterion | Public behavior / adversarial result |
|---|---|---|
| 1 | initial_examples | Initial execution and editable examples; S6 template-separation gap. Public CDN/loopback alternatives allowed. |
| 2 | language_dispatch | Extension-driven JS/HTML/CSS, fresh document, CSS no rerun/handlers; distinct from cancellation timing. |
| 3 | cw_completed_preview_interactions | Delayed click, key and input after Run completion; S5 completed Stop gap, S4 successful DOM commit gap. |
| 4 | fresh_cancel | Supersede active work and Stop active work; own last-good control and setup-window retry. |
| 5 | cw_preview_origin_isolation | Own-document controls around four parent read/write failures; no arbitrary escape catalogue. |
| 6 | cw_runtime_files_not_publicly_exposed | Three paths now publicly reserved; positive controls and accepted denials/fallbacks; limitations above. |
| 7 | cw_preview_network_requests_blocked | Positive text/image transport controls, independent forbidden runs, exact handler counts, cleanup. Public app networking remains allowed. |
| 8 | cw_unsupported_execution_refusal | Five named families individually refused; legitimate words in comments/strings/text succeed. |
| 9 | cw_execution_budget_termination | Distinct braced/unbraced supported loops, preserved logs, deadline, rollback, recovery; no requirement for host UI responsiveness mid-loop. |
| 10 | cw_js_error_line_and_preview_restore | JS source line 4, own prior render, new recovery. |
| 11 | cw_html_error_document_line_and_preview_restore | Full HTML document line 6, own prior render, new recovery. |
| 12 | cw_timer_error_line_and_preview_restore | Timer error line 2, uncaught rollback, recovery. |
| 13 | cw_promise_rejection_line_and_preview_restore | Unhandled rejection line 2, rollback, recovery. |
| 14 | console_levels | Ordered four explicit log levels; console.error correctly not treated as throw. |
| 15 | console_objects | Actual object/nested/array expansion, not source inspection. |
| 16 | console_controls | Retained entries, duration, both follow-scroll states, explicit clear. |
| 17 | auto_run | Measured debounce reset, queued cancellation, manual controls and setup retries; no fixed debounce value demanded. |
| 18 | pane_resize | Both pane allocations and reload persistence; arrangement/pixels free. |
| 19 | editor_basics | All three syntax modes, real line numbers, complete bracket pair; no package/palette assumption. |
| 20 | editor_indent | Multiline Tab/Shift+Tab exact restoration; persistent selection is a conventional interaction assumption. No demonstrated material false failure. |
| 21 | save_load | Two independent records, identity and exact fields, browser reload. |
| 22 | cw_process_restart_durability | Own records across actual restart, no resurrection/duplicate, continuing current-revision save. |
| 23 | persistent_snippets | Real dirty second editor, server stale refusal, exact draft retention and deliberate recovery; proactive conflict prevention accepted. |
| 24 | cw_title_change_uniqueness | Rename-only fields, collision/empty/case rules; S3 successful-trimming gap. |
| 25 | cw_stale_rename_preserves_newer_record | Separate observed stale-rename operation and recovery, valid otherwise. |
| 26 | cw_independent_snippet_copy | Independent identities/content, rejected colliding duplicate, successful extra duplicate. |
| 27 | delete_confirm | Cancel/confirm, stale-delete rejection, no deleted-record upsert, unaffected siblings. |
| 28 | cw_dirty_workspace_transition_warnings | Four independent destinations, cancel/accept, title-only and filename-only dirty cases. |
| 29 | cw_native_dirty_leave_warning | Real interaction before beforeunload, cancellation retains exact draft, accepted reload; tool-dialog behavior called out. |
| 30 | cw_exact_source_file_export | Actual download filename and exact source, no save prerequisite. |
| 31 | cw_supported_source_file_import | Uppercase supported import, no execution with auto-run off, later explicit run/save, unsupported extension/path validation. |
| 32 | cw_theme_switch_legibility | Real both-direction switching and state preservation; visual contrast owned elsewhere. |
| 33 | cw_keyboard_shortcut_actions | Documented actual Run/Save/Clear key events, no assumed bindings. |
| 34 | cw_shared_run_deadline_recovery | Correct distinguishing four-second callback; S1 wording ambiguity and P3 scheduling note. |
| 35 | cw_pending_interaction_budget_nonextension | Distinguishing six-second callback; S1/S2 fairness and S4 rollback-baseline coverage. |

Repeated recovery and own-control runs are necessary to establish each negative operation and were not treated as duplicate independent rewards. Error mapping for sync JS, full HTML, timer callbacks and Promise rejection tests distinct failure paths. Shared original-run and pending-interaction deadlines are separate semantics. Functional theme operation versus Visual appearance and Functional shortcuts versus Polish navigation are explicitly divided. No additional material cross-criterion contradiction or duplicate-score defect was established in this bounded review.

The narrower source/error/network probe set is representative, not exhaustive. For example, every HTML/Promise/timer combination, every network mechanism, arbitrary sandbox escapes, and arbitrary blocking native operations are not established by these fixtures; the latter categories are intentionally outside scope. They should not be silently added by a judge.

## Delivery implication

Repair S1 before using a scarce platform run, and resolve S2 explicitly. S3–S6 are concrete gaps with wrong-implementation witnesses; fixing them strengthens coverage without increasing the number or weights of criteria. Re-run the affected controls locally and verify a new ZIP fingerprint after any changes. This report does not spend or replace either remaining platform run and does not claim the revised task is guaranteed fair.

## Authorized repairs following the review

The parent reviewer authorized edits to exactly `tests/scored/functional/judge.toml`, `tests/scored/functional/prompt.md`, and `tests/app_context.md`. They now accept optional provisional preview visibility and ignored/blocked input during pending work; the pending fixture commits a successful DOM change before its failing interaction; the title fixture successfully creates and renames padded unique titles; the completed-preview fixture Stops the completed preview and proves recovery; and the example fixture saves a modified copy while preserving the built-in original across reload. The example flow accepts any supplied example language and appends a valid comment using that language while retaining its original filename. `fresh_cancel` was aligned to optional pending display too. Shared context now expressly permits the already-supported proactive stale-Save prevention flow with feedback and retained draft.

The completed-preview Stop leg and pending-input leg do not force hidden or disabled controls. The two shared deadlines retain their original four-second and six-second probes. Source bans, positive controls, public-network permission, error/incomplete protocol, all 35 criterion IDs/names/types/order, and total Functional weight 49.5 remain intact. The judge/MCP/scoring configuration is unchanged.

`validate_semantic_repairs.py` parsed the before/after TOML, asserted all these identity/weight/configuration invariants, and generated `repair_validation.json`, exact before/after text files, and unified diffs. Exactly six criterion descriptions changed: `initial_examples`, `cw_completed_preview_interactions`, `fresh_cancel`, `cw_title_change_uniqueness`, `cw_shared_run_deadline_recovery`, and `cw_pending_interaction_budget_nonextension`. The complete modified fixtures were handed to `cold_launch_review` for local runtime validation. Those runtime outcomes are owned by that report and are not inferred here.

The reserved-URL check was left unchanged: its two edge observations remain optional hardening/limitations, and the shared-run scheduling assumption remains a P3 note. The original review's findings remain recorded above against the original ZIP so the before/after rationale is auditable. Final packaging/fingerprint and runtime result aggregation belong to the parent reviewer.
