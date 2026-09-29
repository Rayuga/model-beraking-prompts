# Coverage repair plan

This proposal changes no task files. It retains all original 37 feature budgets, increases 88 binary rows to 93, and retains aggregate Functional weight 49.50. Root owns implementation. This is a bounded browser-evidence repair, not a promise of exhaustive coverage or a full-run time guarantee.

| Shared feature | Before | Proposed independently scored outcomes | Feature total |
|---|---|---|---|
| S02 CSS state exclusion | script/handler absence 0.40 | script/handler absence 0.20; authored global absent during CSS 0.10; old pending timer cancelled by CSS 0.10 | S02 remains 1.50 |
| S25 stale Rename | server refusal 1.50 | server refusal/nonmutation 0.75; actual dirty-editor retention and deliberate recovery 0.75 | 1.50 |
| S28 stale Delete | server refusal 1.00 | server refusal/nonmutation 0.50; actual dirty-editor retention and deliberate recovery 0.50 | 1.00 |
| S33 supported files | supported import 0.60; cross-layer uppercase 0.20 | supported import still 0.60 with all three formats; uppercase import 0.10; uppercase saved filename 0.10 | S33 remains 2.00 |

The current CSS script/handler evidence, HTML-to-JS control fallback, JS-global evidence from S04, Auto-run controls, privacy terminal tree, conditional shared baselines, unindent fallback, completed Stop and all prior valid-alternative wording remain in force. New outcomes do not inherit sibling verdicts.

## S02: globals during CSS

Keep the existing authored assignment `window.oldGlobal='do-not-carry'` and existing actual script/handler success markers. Before CSS, identify the actual authored execution realm from the rendered preview and browser frame/worker lifecycle facts; read that authored property and confirm the assigned value. Merely reading a convenient host frame where it is absent is not a positive control.

After CSS completes, before any JavaScript Run replaces it, identify the current CSS preview/execution state and inspect only the authored property there. It must be absent/undefined. Evidence can be a verified current realm with the property absent, or observed destruction of the old realm plus a matched fresh current realm/context. Retired, hidden old realms are not automatically current CSS state. Do not treat a failed read, no matched target, an unrelated frame or a later fresh JavaScript Run as absence.

Use ordinary browser automation's frame/worker state access, including cross-origin frame evaluation, without reading application scripts, bundles, browser asset bodies or implementation internals. No iframe, hostname, DOM selector or worker architecture is mandated. Do not add a product control for exposing globals.

There is a real observation limitation: a virtualized execution realm may not be discoverable through permitted browser state operations. The evaluator must not label a conforming alternate architecture defective because it cannot match that realm. One bounded setup clarification/retry is appropriate; still-unavailable matched-realm evidence must follow an explicitly named permitted-observation incomplete rule. Root should align the global rule/context if adopting this branch, rather than silently redefining ordinary product failures as tool failures. A plain observed retained authored global is an ordinary product failure.

## S02: separate timer cancellation by CSS

After the existing CSS/global/JS-freshness observations, establish a dedicated supported HTML control (or equivalent ordinary JS control if HTML dispatch failed). It contains a paragraph, a button, a style and an authored click handler. A click increments `n`, logs `css-timer-start-n`, and schedules a four-second callback that changes the paragraph to `css-timer-fired-n` and logs that marker. Initial setup must actually render and log.

1. Click once and observe `css-timer-start-1`, then actual `css-timer-fired-1` DOM/log after the callback. Wait for successful completion. That completed interaction is the recorded last-good state.
2. Click again; observe `css-timer-start-2` and pending work. While its four-second timer is genuinely pending, change only the editor filename/source to supported CSS and Run. Batch this timed sequence when needed; a missed setup window may be retried once.
3. The actual current CSS result retains the last successful paragraph `css-timer-fired-1` and the document's button, and applies the new authored style. Showing a pending interaction candidate before replacement is optional. Do not demand preserved live handlers in the CSS copy.
4. Observe until at least five seconds from the second click. No new `css-timer-fired-2` log, DOM or later success may come from that replaced interaction. Compare marker counts; old history is valid. A succeeding CSS Run without the matching earlier timer-firing control cannot prove cancellation.
5. A short ordinary JS Run subsequently produces its own DOM/log marker. Do not require the old controls to remain interactive.

This is a separate evidence key and score from basic CSS application, script/handler inertness and globals. The dedicated control should permit the same HTML-to-JS setup fallback as the ordinary CSS test. Existing CSS facts remain usable if this later timer leg fails. Nominal added wall-clock observation is approximately four seconds for the successful callback plus five seconds for the replacement observation: about nine seconds, not including browser actions, Runs or recovery. There are three additional nominal Runs (control, CSS replacement, recovery). Total provider/runtime fit remains unmeasured.

## S25: stale Rename with a real dirty editor

Use the existing dedicated record and actual successful rename request format. Open its same current revision in live editors A and B. In B, create distinct valid unsaved title, filename and source; choose an unused dirty title that is also the intended stale rename target. Record all exact fields. Keep B open and dirty while A performs the existing valid current rename and advances the revision.

From B's actual UI, attempt Rename to that same recorded dirty title, or observe deliberate proactive conflict prevention. A normal rename dialog may be completed; do not force a disabled/hidden control. Require useful stale-conflict feedback and exact retention of B's latest unsaved title/filename/source. A valid alternative is a deliberate, explained policy preventing Rename while any dirty work is present, provided ordinary current Rename has actually worked, the exact draft stays intact, and the user has a usable deliberate latest/reapply route. A missing Rename feature or unexplained disabled control is not such a policy. If entering the rename target changes an editable field, record the latest intended draft before submitting, rather than treating that deliberate user edit as data loss.

Observe the actual stale request/refusal if the UI sends it. If prevention suppresses it, separately replay the otherwise-valid old-revision rename in the real successful request shape. Fresh reads verify A's newer title, filename, source and revision remain unchanged. This server outcome can be established even if the UI discarded the dirty draft; the draft row cannot pass from that server fact.

After checking retention, deliberately load the latest record in B. The existing current-revision Rename recovery remains a positive control for the server row. Reapply the retained draft deliberately (with ordinary Save for filename/source where needed) and verify an accepted current write and exact readback. If a broken Rename control blocks that part, an independently observed valid current Save can still establish the draft recovery without earning server Rename-recovery credit. Do not count an automatic refresh that already destroyed the draft as deliberate recovery.

## S28: stale Delete with a real dirty editor

Retain the dedicated Target/Sibling/Control records and actual successful deletion of Control as the server positive control. Load Target at its old revision in live A and B. In B make and record distinct valid unsaved title, filename and source. A updates Target normally and advances its revision; keep B open and dirty.

Attempt Delete from B's actual UI, completing a normal confirmation if offered without scoring that confirmation here. Proactive stale-conflict prevention is valid with useful feedback and exact draft retention. A deliberate explained policy that prevents Delete while dirty is also valid when ordinary current Delete has worked, the exact draft is preserved and latest/reapply recovery is usable; this public brief does not require destructive controls to stay enabled in every state. Do not force unavailable controls or treat a missing feature as explained prevention. Separately observe or replay the valid old-revision request in the successful deletion shape; server refusal and all saved fields/revisions must remain unchanged. A confirmation cancellation is not a stale-conflict test.

Only after retention is observed, deliberately reload latest in B and reapply the retained draft through ordinary current Save with exact readback. Then perform the existing current-revision deletion recovery using the actual latest revision; only Target disappears. Keep the server and dirty-editor results independent. A current Delete can establish server recovery even if the dirty editor previously lost its work.

The extra actual editors and field observations increase work. Reuse the existing current-write and recovery facts within each scenario; do not recreate these records for the new row. No timing claim is made for those browser operations.

## S33: all supported source formats and separate uppercase layers

Keep the JS no-execution and subsequent actual Run control, unsupported-file refusal, independent current server filename probes, and fallback saved control. Preserve their independent attribution.

For the existing supported-file import outcome, add one lowercase `.html` and one lowercase `.css` import, using distinct exact valid texts and filenames. For each, compare the immediate imported filename and exact source; append a valid comment in its own language, save under a distinct scenario-owned title, reload from the library, and verify the exact edited source/filename and actual saved identity. An initial save before the edit is unnecessary. This directly observes imported editability and persistence without requiring additional preview Runs. Handle dirty-work confirmations deliberately. Keep Auto-run off; the JS leg retains ownership of the no-execution outcome.

Suggested HTML source: `<!doctype html>\n<html><body><p>html-import-original</p></body></html>\n`; append `<!-- html-import-edited -->\n`. Suggested CSS source: `p { color: rgb(1, 2, 3); }\n`; append `/* css-import-edited */\n`. Compare the exact actual bytes/text supplied; no particular line ending convention is required beyond fidelity to that supplied fixture.

Split the existing uppercase `.JS` observation into two keys: importer acceptance with exact filename/source, and server acceptance/persistence of a supported uppercase filename. An uppercase importer failure must not prevent the server observation: set the filename on the already imported lowercase draft or other valid independently saved fixture, then perform the actual current Save. A server failure must not erase an observed successful uppercase import. This adds one row, not a second execution of the scenario.

Use the three-language matrix as representative support of this one import feature. It does not require every casing/encoding/filename cross-product or a prescribed file-input implementation. Save/readback is intrinsic to the asked import-to-editable-saveable-draft flow, while the unrelated no-execution, rejection and cross-layer case outcomes remain separate.

## Required final review

- Verify 93 unique binary rows and exact Decimal total 49.50; each original37 feature subtotal unchanged.
- Bind the actual edited prompt, context and descriptors; recompute resolved payload size rather than assuming prior launchability.
- Check all new absent/refused/unchanged outcomes have their own meaningful successful controls; shared facts never require sibling verdicts.
- Check false implementations for retained CSS global, live old timer, Rename-only draft loss, Delete-only draft loss and JS-only importer are now distinguishable.
- Check legitimate hidden pending previews, proactive prevention, disabled controls, static CSS/rollback, alternate execution realms and genuine public assets remain valid.
- Report runtime observations and unavailable architecture evidence separately; do not label all QC passed or predict provider timing without measurement.
