# Colderwater requirement-first coverage after the network-policy correction

This ledger starts with the seven participant-facing documents, then identifies actual observable checks. It is tied to the frozen rubric revision of 2026-09-26: **32 functional binary criteria, internal weight 49.5; two binary gates; four polish binary criteria; six visual criteria**. Functional/polish/visual remain 0.6/0.2/0.2, with the unchanged strict Functional > 0.05 floor. Exact source hashes and local contract results are in `contract-checks.json`; split history is in `criterion-crosswalk.json`.

The authoritative review process is `harbor-webdev-rubric-qc/SKILL.md`, its staged-contract references and all workbook checks. This document is the contract/coverage part of that review, not a replacement for the full workbook, packaging checks or a paid judge. The user authorized edits; the skill's default review-only restriction therefore did not block these fixes.

## Preserved earlier rubric repairs

The screenshot's ten failed quality checks are transcribed in `PLATFORM_FAILURES.md`. Earlier local confidence was too broad: a criterion-to-requirement map established that existing tests were justified but did not establish that every explicit requirement was tested. It also treated a few multi-feature checks as acceptable flows without considering how independently useful behavior would earn credit. Removing criterion-ID collisions did not remove the separate phrase `verifier files` or improve natural owner voice.

The brief and six notes now use the owner's problem and ordinary product language. Technical setup belongs in integration; grading vocabulary is absent from public documents. Separate scores now cover export/import, parent isolation/network refusal/unsupported execution, normal/stale rename, in-app/native draft protection, and four error paths. Positive controls, rejection and recovery remain together where they establish one behavior and avoid false passes from broken routes or unusable apps.

Startup is deliberately clarified: opening provides useful code with automatic preview and console output, whether that code is an example or a saved snippet and whether the library is empty or not. This preserves the original broad request for a working opening state and resolves the former note that only mentioned an empty installation. A gate can create a saved record before Functional; no test removes it or relies on a particular gate record being selected.

The strengthened gates independently establish basic authored execution and a genuinely shared saved library. The constraints gate creates a uniquely titled record, observes the write, and retrieves it in a clean browser context without copying local storage; Render runs newly authored source and observes its DOM and console marker. Neither gate carries reward mass. `MOCK_GATE_VALIDATION.md` records inert-runner and client-only-library counterexamples. These observations establish specific behavior, not the app's database engine from the browser.

## Public requirements mapped to observations

References below are relative to `projects/colderwater-playground-devtools`. F01–F32 refer to the ordered inventory below. Notes are cited by file and section to avoid brittle line references after prose edits.

| Public source and requirement | Actual observation and boundary |
| --- | --- |
| `instruction.md`; `overview.md`: local public playground, no accounts | Both gates open the workspace directly and perform Run/Save without authentication. |
| `overview.md`: useful automatic code, preview and console on opening | F01 opens a fresh page and observes automatic output without pressing Run; an existing saved library is valid. |
| `overview.md`: own useful examples and editable source | F01 selects an example, runs it as needed, then replaces it with newly authored DOM/log output. Static sample output is insufficient. |
| `overview.md`: filename alone selects JS/HTML/CSS, case-insensitively | F02 runs `.JS`, `.html`, `.CSS`, then `.js` without using another language selector. F28 imports and saves `.JS`. Extra controls are allowed. |
| `behaviour.md / The preview`: JavaScript uses a fresh document | F02 moves from HTML with a global to fresh JS and observes `undefined`; F03 independently checks no prior-run global in a replacement run. |
| Same section: complete HTML replaces output | F02 replaces its own preceding JS result with a complete HTML document and observes new content. |
| Same section: CSS copies last successful document/styles without re-executing scripts | F02 applies a stylesheet to the successful HTML heading, verifies colour, and confirms its old script log was not repeated. This samples lifecycle isolation; it does not enumerate every possible handler/native object. |
| Same section: replacement cancels pending work, identifies reason and suppresses late output | F03 proves A active, replaces it with B within the known timer interval, waits beyond A's deadline and checks no old logs/DOM takeover. |
| Same section: Stop cancels, identifies reason, restores last good and permits recovery | F03 independently starts a pending timer, presses Stop, observes rollback and no delayed marker, then runs valid recovery. |
| Same section: literal supported loops stop for five-second budget without freezing UI | F07 independently probes braced and unbraced literal loops, initial logs, timeout reason, last-good retention, host responsiveness and recovery. About eight seconds allows bounded scheduling overhead. |
| Same section: callbacks share original five-second budget | F31 delays a literal runaway callback by 4000 ms, observes it entered, then requires timeout by about eight seconds from original Run. A fresh callback budget would finish around nine seconds and fails. |
| Same section: failed candidate never becomes last good | F08–F11 each mutate their own candidate DOM, trigger a different error, require their own successful preview restored and recover. F03/F07 cover cancellation/timeout rollback. |
| Same section: user-source error message/one-based line, including full HTML | F08 exact JS line 4; F09 complete HTML line 6; F10 timer line 2; F11 unhandled Promise line 2. Each fixture includes a separate control and recovery. Wrapper offsets cannot pass. |
| `behaviour.md / Console and automatic runs`: four levels in order | F12 logs log/warn/error/info and checks exact values/order and distinct level indicators. A logged `console.error` is not treated as uncaught failure. |
| Same section: inspect nested objects/arrays | F13 expands app console entries and reads nested value and individual array values, not source text. |
| Same section: logs survive runs until Clear, real duration | F14 creates 40 entries, appends across runs, checks duration, then clears. F30 separately checks the documented Clear shortcut. |
| Same section: follow only when already at bottom | F14 measures console position when scrolled away, appends, then repeats at bottom and checks new row visibility. |
| Same section: debounce, off blocks execution and cancels queued run | F15 checks delayed execution, disabled no-run, manual execution and an edit immediately followed by disabling Auto-run. Timing setup may be repeated once if it visibly missed the window. It does not impose a particular debounce interval. |
| `behaviour.md / Saved snippets`: shared stable identity and exact title/filename/source | Constraints proves clean-context server retrieval. F19 writes two records, loads/reloads both and compares exact fields/identities. |
| Same section: Save updates current record, new draft creates separate one | F20 updates the same observed identity and revision; F19 creates two distinct records through New. |
| Same section: trimmed nonempty unique titles; case-sensitive comparison | F21 uses current revisions for exact and whitespace collision attempts, blank/whitespace title refusal, a positive case-only title pair, unchanged records/revisions and valid recovery. |
| Same section: single supported source filenames, extensions case-insensitive | F28 accepts `.JS`, refuses unsupported UI import, and rejects current-revision server updates to `unsupported.txt` and `nested/demo.js` without mutation. No hidden length or reserved-name rule. |
| Same section: rename changes only selected stored title | F21 performs normal rename, fresh read of filename/source, sibling preservation and later valid recovery. |
| Same section: duplicate independent identity and subsequent edits | F23 duplicates exact filename/source, edits Copy only, reloads both, refuses a name collision with unchanged records and proves another unused duplicate succeeds. |
| Same section: delete confirmation, cancel no mutation, selected-only deletion | F24 owns Target/Sibling/Control, tests cancellation and a successful Control delete, then current-revision Target deletion while retaining Sibling and unrelated records. |
| Same section: revisions protect save from another editor | F20 establishes two snapshots and a successful first write; stale second write refuses without changing any field/revision. Latest reload/reapply/save succeeds and dirty work is retained until chosen recovery. |
| Same section: revisions protect rename | F22 owns a fresh record, captures a successful rename, uses its older snapshot with a valid unused title, verifies no mutation and proves latest-revision recovery. A collision cannot stand in for stale rejection. |
| Same section: revisions protect delete and deleted identity cannot return | F24 advances Target, refuses its old-revision delete, permits current deletion, then refuses an update against the deleted identity without resurrection. |
| `behaviour.md / Unsaved work and files`: current record and dirty title/filename/source visible | F25 observes current record and all three edits; separate title-only and filename-only edits prove those fields also mark the draft dirty. Source-only native handling is exercised in F26. |
| Same section: warn before saved-record load/example/New/Import | F25 recreates its own dirty state independently for all four actions. Cancel preserves exact fields; accepted replacement actually changes destination; stored original stays unchanged. |
| Same section: native warning on reload/leave after interaction | F26 clean reload is a control; real keyboard edit followed by reload creates native dialog, dismissal retains exact draft, acceptance reloads and stored source remains original. Browser-specific dialogue wording is free. |
| Same section: export actual filename and unchanged exact source | F27 inspects a real download from an independent draft, without making import or save a prerequisite. |
| Same section: supported import editable/saveable; unsupported import preserves draft | F28 uses a real file input, exact filename/source, save/reload, rejected `.txt` with retained draft, and later valid edit/save. |
| Same section: import with Auto-run off does not execute until Run | F28 establishes a good preview, imports exact DOM/log source, waits two seconds with no imported output, then presses Run and observes both outputs. Editable text alone is not evidence. |
| `security.md`: own DOM/console valid but parent document/storage inaccessible | F04 valid control; four authored read/write attempts; all blocked; measured host title/storage unchanged; normal recovery. No additional escape catalogue. |
| Same note: eval, Function, WebAssembly, workers and dynamic import refused clearly | F06 makes five independent bounded attempts after its own successful preview; each refuses without claiming success or replacing last good; ordinary recovery succeeds. Worker/import use local data URLs, not internet availability. |
| Same note: feature names in harmless strings/comments/HTML text work | F06 exact valid HTML contains all five names in paragraph, comment and logged string. It must render and log successfully before refusals. |
| Same note: snippets cannot request external resources/services | F05 first fulfills exact reserved `.invalid` text/SVG URLs in an unprotected control page. Separate authored fetch and Image attempts each show blocking and add no route-handler delivery, then normal DOM/log recovery succeeds. This samples two materially distinct request paths, not every browser networking API. |
| `security.md`, `integration.md`, `policy.md` and brief: external app browser assets are permitted | F01 explicitly accepts app fonts/scripts/editor/CDN resources; no browser-origin or asset-network failure is scored. The separate F05 snippet-resource boundary is unchanged. The public-network guard verifies current prose/configuration agreement. |
| `ui.md`: three usable panes with persistent resizing | F16 resizes both relevant allocations, reloads and checks proportions persist; no direction or pixel values prescribed. |
| Same note: narrow screen remains usable | Polish `responsive_layout` checks access to panes/controls at roughly 390×844; stacking, tabs, drawers and intentional code scrolling are allowed. |
| Same note: monospaced editor, line numbers, language syntax and bracket matching | F17 checks all three languages and a complete bracket pair with adjacent cursor. No editor package or palette is required. |
| Same note: multiline indentation/reversal without data loss | F18 selects three lines, Tab adds consistent indentation and Shift+Tab restores exact source and selection. Width and tab representation remain free. |
| Same note: discoverable controls, labels and visible keyboard focus | Four simple polish checks cover names, at least three focused controls, ordinary feedback and understandable workspace surfaces. The actual shortcuts are F30. |
| Same note: documented working Run/Save/Clear shortcuts | F30 uses app-documented combinations, executes newly authored code, saves its own draft and clears logs without substituting buttons. |
| Same note: legible light/dark workspace themes | F29 switches away and back, checking actual whole workspace treatment. Either initial theme is allowed; authored preview content is not forced to adopt app colours. Visual criteria judge readability without regrading shortcut/runtime behavior. |
| `integration.md`: durable identities/source/revisions across full restart, no duplicate/resurrected records | F32 creates its own primary/copy/deleted controls, records full observed library, calls real restart helper once, checks exact surviving fields/revisions, runs saved source and proves a later revision-aware save. No prior verdict is a prerequisite. |
| `policy.md`: layout, labels, indentation, API routes/fields free | Criteria discover controls and observed successful requests, accept equivalent layouts and use loaded revisions. No fixed endpoint schema, indentation width, mandatory initial theme or extra language-control prohibition. |

## Setup and architecture promises: honest observability limits

`integration.md` still specifies TypeScript/React/Vite, Node/Express/better-sqlite3, SQLite, one server, `/app/server.js`, source/package/lockfile, `/app/public/index.html`, the database path/DB_PATH override and compiled application assets. External browser dependencies are permitted. Launchers, packaging and image checks address the runtime contract. Browser evidence demonstrates prompt `/api/health`, Run, server persistence and restart behavior; it cannot prove the framework, SQLite engine, exact internal file layout, lockfile provenance or absence of every secret/file exposure. Those claims must not be marked covered merely because a request succeeded.

Likewise, an exhaustive proof of no server-side source evaluation, every possible native blocking operation, every CSS-carried event handler or every external network mechanism is not claimed. The task explicitly limits its time-bound promise to supported source-written code and refuses named dynamic families. The UI suite and structural/runtime review provide additional evidence; ordinary representative cases remain the scoring scope. This distinction prevents adding hidden exploitation tests solely to make a broad sentence appear exhaustively tested.

## Final criterion inventory

| No. | ID | Weight |
| --- | --- | ---: |
| F01 | initial_examples | 0.5 |
| F02 | language_dispatch | 2.5 |
| F03 | fresh_cancel | 3 |
| F04 | cw_preview_origin_isolation | 1.25 |
| F05 | cw_preview_network_requests_blocked | 0.5 |
| F06 | cw_unsupported_execution_refusal | 1.75 |
| F07 | cw_execution_budget_termination | 3.5 |
| F08 | cw_js_error_line_and_preview_restore | 1 |
| F09 | cw_html_error_document_line_and_preview_restore | 1 |
| F10 | cw_timer_error_line_and_preview_restore | 1 |
| F11 | cw_promise_rejection_line_and_preview_restore | 1 |
| F12 | console_levels | 1 |
| F13 | console_objects | 1.5 |
| F14 | console_controls | 1.5 |
| F15 | auto_run | 2 |
| F16 | pane_resize | 0.5 |
| F17 | editor_basics | 1 |
| F18 | editor_indent | 1 |
| F19 | save_load | 1.5 |
| F20 | persistent_snippets | 3 |
| F21 | cw_title_change_uniqueness | 1.5 |
| F22 | cw_stale_rename_preserves_newer_record | 1.5 |
| F23 | cw_independent_snippet_copy | 2.5 |
| F24 | delete_confirm | 3 |
| F25 | cw_dirty_workspace_transition_warnings | 1.25 |
| F26 | cw_native_dirty_leave_warning | 0.75 |
| F27 | cw_exact_source_file_export | 0.5 |
| F28 | cw_supported_source_file_import | 2 |
| F29 | cw_theme_switch_legibility | 0.5 |
| F30 | cw_keyboard_shortcut_actions | 1 |
| F31 | recovery_persistence_chain | 2.5 |
| F32 | cw_process_restart_durability | 2.5 |
| Total | 32 binary criteria | 49.5 |

## Preserved earlier feature-split analysis and practical burden

Every newly strengthened refusal has a working control. Data-validation requests use the actual observed successful shape, the correct identity and current revision, with unrelated fields valid. Stale-operation tests intentionally use an old revision and otherwise valid unused titles. Independent records keep normal rename, stale rename, save, delete, duplicate and restart results from becoming dependencies on earlier successes. Existing gate and unrelated library records remain intact. Each error path owns its good render and recovery; unsupported families run separately. Network control failure cannot prove security, and caught blocked operations may complete their legitimate own-DOM work without forced rollback.

These subdivisions change partial credit even though the total weight stays 49.5. The exact old→new crosswalk is in `criterion-crosswalk.json`. Holding behavior fixed, and conditional on gates and floor already passing, the groups can expose at most 10 formerly all-or-nothing raw points: 2.25 for the sandbox redistribution, 3 errors, 1.5 rename, 1.25 dirty handling and 2 import/export. That is 0.6×10/49.5 = 0.121212… unrounded reward; the actual score tool's rounded bound is documented by the root score-policy evidence. Network was **not** an old prerequisite, and the new negative legs can reduce credit. Crossing the floor is discontinuous, so this conditional arithmetic is not a model-score forecast. There is no measured claim that a model lands in 0.1–0.7 or that the paid Oracle equals 1.

The fixed functional budget remains 9000 seconds. Moving from 24 to 32 outcomes adds repeated independent controls, five unsupported runs, two network attempts/control setup, four dirty cancel/accept paths, and dedicated validation/recovery actions. It reduces diagnostic coupling but increases judge work. The actual pinned browser exercised these sequences successfully; complete paid judging latency is still unmeasured. The network recipe was also proven feasible through the installed MCP tool, not assumed from a standalone Playwright API.

`../rubric-fix-2026-09-26/GOLDEN_FIX_AND_BROWSER_PROOF.md` reports 65 passed local groups (59 browser groups in Chromium 152.0.7977.8 and six installer lifecycle groups), including all new branches and unchanged runtime/library regressions. Its referenced raw JSON and scripts are the execution evidence. The positive proof, permissive network mock and dead-app gate fixtures complement one another. Local deterministic checks do not guarantee every private platform judgment; natural owner voice and whether a linked behavior remains acceptably grouped still involve reviewer judgment.

Source is frozen. Evidence files remain outside the upload archive. Any later task-source change requires a new hash/contract check and rerunning the relevant behavioral proof, not merely reusing these results.


## Current seven-file correction

The prior app-wide offline-assets conclusion is withdrawn. Archive998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686 permits external browser assets and changes only F01 description among criteria. All32 weights/IDs and other31 descriptions are unchanged. The earlier score-split analysis above describes the previous24→32 revision; it is not the score effect of this correction. Current F01-only conditional published gain is at most0.0061, with separate abstract floor unlocking0→0.4333. These are bounds, not measured model outcomes. QC_FINAL.md and independent_review_evidence.json bind this map to the current archive; earlier59 browser/six installer groups are preserved evidence for byte-identical behavior, not newly rerun tests.
