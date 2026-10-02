# Judge walk: saving, live update, polish and visual criteria (golden vs literal judge)

Candidate: `.qc-cache/coldwater-strict-2026-10-02-r5/task`. Static trace only (no browser run, no judge run).
Scope: last 7 functional criteria, 6 polish criteria, 3 visual criteria, the three prompts and `tests/app_context.md`.

Problems found: 3 (1 GOLDEN FAILS, 2 AMBIGUOUS). Everything else in scope traced clean; see the end.

---

## 1. GOLDEN FAILS (path dependent, likely path) - `cw_unsaved_marker`

Criterion sentence: "Type one character in the source: a visible indication that there are unsaved changes must appear. Use Undo until the source equals the saved text again: the unsaved indication must go away." Fail clause: "if it stays after Undo restored the saved text".

Golden code:
- `solution/app/src/custom-editor.js:573-575` - a single typed character opens a new Undo step only when `state.typingGroup` is null or the caret moved since the previous keystroke.
- `state.typingGroup` is cleared only at lines 72 (setValue), 206 (restore), 217 (pushUndo), 269 (Escape), 355 (mouse down in the code), 772/811 (caret movement), 1006 (find).
- `solution/app/src/app.tsx:62-74` - `save()` never touches the editor except `editor.current?.focus()` in `finally`. Ctrl+S inside the editor (`custom-editor.js` key `s` branch, about line 303) also leaves the group open.

What the judge observes: the judge enters the source by key presses (the editor is a div, so Playwright MCP cannot `fill` it; it types character by character, which the golden groups into one Undo step), presses Save, and, because focus is returned to the code, types one more character at the same caret. That character joins the pre-Save typing group, so no Undo step exists at the saved text. One Undo jumps from "saved text + x" straight back to the state before the whole typing run (the New starter source, or empty). The source never equals the saved text, Redo returns to "saved text + x", and the heading keeps reading "Unsaved changes" (`app.tsx:142,149`). The step "Use Undo until the source equals the saved text again" cannot be completed, so a literal judge fails the criterion. The golden passes only if the judge pasted the source, or clicked or moved the caret between Save and the extra character.

This also contradicts the public note in `environment/instructions/ui.md` ("that marker goes away after Save and when Undo brings the source back to the saved text").

One-line fix (golden): end the typing group when a Save succeeds, for example expose `breakUndoGroup: () => { state.typingGroup = null; }` from `mountCodeEditor` and call it in `save()` before `setBaseline`, so the saved text is always an Undo boundary.

---

## 2. AMBIGUOUS - `cw_history_restore_retry`

Criterion sentence: "Whatever that second tab does, the fifth revision's distinctive source must still be listed in the history afterwards: the restore is either refused or added on top as a later revision." Fail clause: "if the fifth revision's source is no longer in the history after the second tab's restore."

Golden code:
- `solution/app/server.js:107` with `52-58` - the second tab's restore carries revision 4 and is refused with 409 `REVISION_CONFLICT`.
- `solution/app/src/app.tsx:89-91` - the second tab shows the status "Restore was not confirmed..." and the conflict notice, but keeps `record` at revision 4.
- `solution/app/src/app.tsx:120` - history is fetched only when `record.id` or `record.revision` changes, so the second tab's history list still shows revisions 1 to 4 only. Revision 5 appears there only after "Reload latest" (`app.tsx:75-79,151`).

What the judge observes: the criterion does not say where to read the history. A judge that reads it in the second tab, straight after the refused restore, sees revisions 1 to 4 and no fifth revision, and can report "the fifth revision's source is no longer in the history". Read in the first tab or in a fresh page, the golden passes.

One-line fix (criterion text): add "Read the history in the first tab or in a fresh page; a tab that was refused may still list the older history until it reloads the latest revision."

---

## 3. AMBIGUOUS - `cw_focus_returns_to_code`

Criterion sentence: "Do the same check after clicking Undo, after clicking Redo, after a Replace all that changed something, and after clicking Save: each time, typing one character straight afterwards must insert it into the source."

Golden code:
- `solution/app/src/custom-editor.js:213-224` - any new edit empties the Redo stack.
- `solution/app/src/custom-editor.js:1161-1162` - Redo is disabled while that stack is empty (required by `cw_undo_redo_availability` and by `ui.md`).

What the judge observes: followed in the written order, the character typed after the Undo check clears Redo, so the Redo button is disabled when the judge reaches the Redo check. A Playwright click on a disabled button times out; the polish prompt says "If a browser tool errors, retry once, then fail that criterion". The judge has to work out for itself that it must click Undo again before clicking Redo. The same holds for any correct app, since the disabled state is required behaviour.

One-line fix (criterion text): "Before the Redo check, click Undo once more so that Redo is available, then click Redo and type."

---

## Traced clean (no problem reported)

- `cw_save_reload_restart`: record, revision heading and history are all server state (`server.js:65-94`, `app.tsx:120,149`); nothing depends on browser storage except pane sizes.
- `cw_stale_save_refused`, `cw_stale_save_keeps_draft`: revision check runs before field validation (`server.js:80-82`); the stale tab gets the status "Save failed - your draft is kept", a console error and the alert notice (`app.tsx:70-73,151`); title, filename and code state are not touched, and focus returns to the code.
- Retry control: "Retry same restore" resends the stored request with the same operation id (`app.tsx:82,160`); the server returns the stored result (`server.js:102-106`), no fifth revision.
- `cw_live_library_update`, `cw_newer_revision_notice_keeps_draft`: two-second polling plus focus and visibility refresh (`app.tsx:134-139`), notice at `app.tsx:140-141,152`. Playwright launches Chromium with background timer throttling disabled, and even one-second throttling is inside the ten-second window.
- `cw_live_update_keeps_editing_state`: the poll only calls `setSnippets`; the editor DOM is outside React and the `[code]` effect (`app.tsx:116`) does not fire. The marker is its own Undo step because placing the caret by click or arrow keys ends the typing group.
- `cw_controls_keyboard_and_focus`: all listed controls are native buttons or inputs; global `:focus-visible` outline (`style.css:1`) and the editor outline (`style.css:14`); "Escape, then Tab" is shown in the editor footer (`custom-editor.js:1170`) and the page footer (`app.tsx:170`), and works in both directions (`custom-editor.js:267-274,340-341`).
- `cw_controls_feedback_and_labels`: Run "Complete" or "Error - previous preview retained" (`runtime.ts:402-403`), Save status (`app.tsx:69`), Format message (`custom-editor.js:95`).
- `cw_undo_redo_availability`: `setValue` resets both stacks on load and New (`custom-editor.js:72`, `app.tsx:59`); disabled states at `custom-editor.js:1161-1162`.
- `cw_narrow_width_usable`: column layout below 850 px, wrapping toolbars and `overflow-x:hidden` (`style.css:1,33-49`); no fixed-width element wider than 390 px found by reading the styles. Not rendered here.
- Visual criteria: Likert anchors, nothing in the golden that reads as overlap, clipping or default styling at desktop size from the source.
