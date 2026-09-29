# Colderwater contract and functional fairness ledger

Date: 2026-09-26. Profile: staged gates and scored dimensions. This authoring evidence stays outside the task ZIP.

The downloaded functional rubric actually contained 24 criteria with total internal weight 67.5. The revised rubric preserves those 24 IDs and uses total weight 49.5. Dimension shares remain functional 0.6, polish 0.2 and visual 0.2. These weights describe the rubric, not measured Oracle or candidate-model results.

## What was clarified

The original six brief files omitted most library workflows that the rubric already required: rename collisions, independent duplicates, confirmation cancellation, import/export details and dirty navigation. The new notes explicitly define them. Revision-aware saves and deletes add a realistic data-loss problem: an old editor cannot overwrite or delete newer work, and an update cannot recreate a deleted record.

The run model now separates an in-progress candidate preview from the last completed successful preview. CSS gets a fresh isolated context based on the last successful rendered document; it does not reuse old JavaScript globals, scripts, timers or handlers. Errors, Stop and timeout restore the last successful render. Timer and Promise failures count as run failures.

The five-second execution promise is scoped to supported source-authored JavaScript, functions, literal loops and scheduled callbacks. It does not claim to preempt arbitrary browser-native blocking operations or unrestricted generated code. eval/Function, WebAssembly, new workers and dynamic imports are explicitly unsupported and refused. Merely spelling those words in text, comments or strings remains valid.

## Requirement-to-criterion map

| ID | Weight | Contract anchor | Concrete evidence and fairness guard |
| --- | ---: | --- | --- |
| initial_examples | 0.5 | overview: immediate working example; security/integration: local assets | Initial real code/preview/logs plus a separately authored run. Browser network evidence distinguishes app requests from tool traffic and permits local loopback preview hosts. |
| language_dispatch | 2.5 | overview extensions; behaviour run model | Uppercase JS/CSS dispatch, HTML replacement, CSS preserving the last good document without rerunning its script, then clean JS globals. Optional language controls are allowed. |
| fresh_cancel | 3 | behaviour cancellation, Stop and rollback | A prior valid render, pending A superseded by B, no late A output, then explicit Stop restoring B. Time-sensitive actions can be batched; a missed setup window is not a false app failure. |
| sandbox_isolation | 3.5 | security isolated context and supported scope | Legitimate own-DOM/text control first; parent document/storage writes blocked with unchanged host values; direct eval refused; legitimate use afterward. No unrequested escape catalogue. |
| timeout | 3.5 | behaviour shared five-second budget; security scope | Literal braced and unbraced loops stop with visible reasons, original logs and rollback. Host responsiveness and a recovery run are checked. No native time-bomb substitution. |
| error_lines_preview | 4 | behaviour errors, exact user-source lines and last-good render | JS line 4, complete HTML line 6, timer throw line 2 and Promise rejection line 2. Each partially changes DOM before failure, so cosmetic error text without rollback cannot pass. |
| console_levels | 1 | behaviour console call order and levels | Actual four-level output in order. Labels or other unambiguous indicators are valid; no specific colours. |
| console_objects | 1.5 | behaviour expandable values | Expand the rendered nested object and array; source text is not a substitute for observed values. |
| console_controls | 1.5 | behaviour retained logs, timing, scroll-follow and Clear | Actual rows, measured duration, preserved scrolled-up view, bottom-follow and clearing. Unrelated status labels can remain. |
| auto_run | 2 | behaviour debounce and disabling queued work | Positive automatic run, disabled edits, cancellation of a queued debounce and manual recovery. No fixed millisecond implementation requirement. |
| pane_resize | 0.5 | ui resizable, remembered usable panes | Change both allocations and reload. No prescribed orientation or exact pixels. |
| editor_basics | 1 | ui gutter, mono font, syntax and bracket matching | Real lines and syntax across three languages, then a complete bracket pair. An unmatched opening bracket is no longer used as a matching test. |
| editor_indent | 1 | ui selected-line indentation | Multi-line Tab/Shift+Tab exact text reversal. Indentation width is free. |
| save_load | 1.5 | behaviour stable records and exact fields | Two independently created records, exact load and full browser reload. New draft is distinguished from renaming a loaded record. |
| persistent_snippets | 3 | behaviour revisions and conflict recovery | Two snapshots of one revision; valid first save; stale second refusal; unchanged latest fields/revision; explicit reload and successful reapplication. Replaces a redundant page-reload-only check. |
| rename | 3 | behaviour unique trimmed titles, atomic validation | Positive rename, current-revision collisions including surrounding whitespace, unchanged records, valid recovery. A stale revision cannot masquerade as a uniqueness check. |
| duplicate | 2.5 | behaviour independent duplication and uniqueness | Separate identities, independent edit, direct duplicate-title rejection without overwrite, then another valid duplicate. No required automatic suffix. |
| delete_confirm | 3 | behaviour confirmations, revision deletes and no resurrection | Cancelled confirmation, real successful control deletion, stale target deletion refused, fresh deletion accepted, old update cannot recreate target. Other library rows are preserved. |
| dirty_navigation | 2 | behaviour unsaved title/filename/source and native unload guard | Cancel preserves exact draft, accept navigates, saved original remains, filename changes also count, native warning after actual user interaction. Tool dialog suppression is not blamed on the app. |
| import_export | 2.5 | behaviour single-file import/export and filename validation | Exact downloaded name/text, uppercase supported import, unsupported import preserving draft, current-revision invalid-filename server refusal, successful supported save afterward. |
| themes | 0.5 | ui light/dark and legibility | Either initial theme accepted; switch and return. Authored preview document styling is not required to follow the workspace theme. |
| keyboard | 1 | ui documented shortcuts | Actual Run, Save and Clear shortcuts. New draft begins before entering the probe code so saving does not accidentally test an empty replacement draft. |
| recovery_persistence_chain | 2.5 | behaviour shared callback budget, saved work and rollback | Saved normal run, timer callback containing literal infinite loop, timeout rollback, original saved content reloaded and run again. No dependency on final persistence verdict. |
| persistence | 2.5 | integration durability and behaviour revisions | Creates its own original, independently edited duplicate and deleted control before one actual restart. Exact identities/fields/revisions persist, then a fresh valid save still works. |

The substantive runtime group totals 21.5; console behavior totals 4; library and durable state total 20; editor/pane/theme/shortcut behavior totals 4. Together they total 49.5. The purely presentational/editor-surface checks pane_resize, editor_basics and themes total 2/49.5 = 0.0404, below the functional floor of 0.05 even if awarded alone. This is not a reason to deny credit for genuinely working editing behavior.

## Revision probe discipline

All mutation probes use the method, path, identity and payload/header shape observed in a successful UI operation.

- Stale-save and stale-delete probes deliberately retain the old revision after a demonstrated successful newer save.
- Collision and invalid-filename probes deliberately use the latest current revision, so rejection cannot be explained by an unrelated stale-version error.
- A refusal requires a fresh read showing unchanged fields and revision. A status code alone is insufficient; no particular 4xx is prescribed.
- A deleted identity cannot be recreated by an old update. Creating a genuinely new draft remains allowed.
- Two captured editor snapshots are sufficient. No particular multi-tab/localStorage architecture is required.

## Exact source-line fixtures

The error samples have no leading blank line. Their expected one-based lines are derived from the literal text, not a wrapper:

- bad.js: the fourth line calls items.forEeach; lines 1-3 are candidate DOM update and declarations.
- bad.html: the document starts with doctype at line 1, script opens at line 5, and undefinedFunctionCall is at line 6 of the full HTML.
- delayed-error.js: setTimeout and its throwing callback are on line 2.
- rejected-promise.js: Promise.reject(new Error(...)) is on line 2.

The external source-contract check validates these fixture positions, criterion uniqueness, totals, prompt substitutions and removal of retired source paths. It does not establish runtime line reporting.

## Outstanding measurement boundary

Source fairness, parsing and fixture checks are separate from local browser/backend execution, the full 53-judgment/48-deterministic QC review and paid measurements. Nothing in this ledger claims Oracle 1.0 or a candidate score in 0.1-0.7. Those require actual graded runs; local evidence must be labelled according to what was exercised.