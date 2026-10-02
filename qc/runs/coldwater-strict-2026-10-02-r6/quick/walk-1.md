# Walk 1: can the golden fail the editor criteria under a literal judge?

Frozen task: `.qc-cache/coldwater-strict-2026-10-02-r6/task`. Source trace only; nothing was run in a browser.
Scope: render gate, constraints gate, and the ten listed functional criteria.

Result: no GOLDEN FAILS, no NOT ACHIEVABLE. Four AMBIGUOUS problems, listed by severity.

## 1. AMBIGUOUS (high) - cw_multi_caret_delete

- Sentence: "With real modifier-clicks place two carets at the ends of two different lines." and "Then place two carets at the starts of two different lines."
- Golden: `solution/app/src/custom-editor.js:360-374`. A modifier-click always adds to the existing caret set (`existing = [state.caret, ...state.extraCarets]`); only an ordinary click resets it (`:399-401`).
- Judge would observe: read literally (two modifier-clicks), the caret left where the fixture was typed stays, so there are three carets. One Backspace then changes three places and the judge hits "a neighbouring line or character changes". The second half is worse: Undo restores the earlier carets (`:198-205`), so further modifier-clicks give four or more. If a modifier-click lands on the existing caret it toggles that caret off (`:364-365`).
- Fix: word it like cw_multi_caret_typing_atomic: "Use one ordinary click, then one real modifier-click, so exactly two carets sit at ..." in both halves.

## 2. AMBIGUOUS (medium) - cw_mouse_selection

- Sentence: "Confirm each selection by copying it with the usual keyboard shortcut and comparing the copied text" for the triple click and the cross-line drag.
- Golden: `custom-editor.js:376-388` (triple click selects through column 0 of the next line), `:493-506` (copied text contains `\n`). The only ordinary fields are single-line inputs: Find and Replace (`custom-editor.js:13,15`), Title and Filename (`app.tsx:152`).
- Judge would observe: with no clipboard permission the copy can only be read by pasting. A single-line input drops or flattens the line break, so the pasted text is not the stated selection ("ha\nga" reads as "ha ga" or "haga"). A literal judge can call that "different".
- Fix: add to app_context.md that a copied multi-line selection should be checked by pasting it back into the editor (for example at the end of the draft), or that a line break pasted into Find appears as a space or is dropped.

## 3. AMBIGUOUS (medium, tooling) - cw_mouse_selection, cw_multi_caret_typing_atomic, cw_multi_caret_delete, cw_long_line_editing

- Sentence: "a triple click", "a drag from the middle of one line to the middle of the next", "one real Alt+Click and one real Ctrl/Cmd+Click ... after distinct words".
- Golden: `custom-editor.js:19` (the editor is a single `role="textbox"` div), `:521-523` (`pointToPosition` returns null unless the pointer is over a `.line` row), `:356-357` (mousedown then does nothing).
- Judge would observe: both judge.toml files start `playwright-mcp` without the vision capability, so the only way to click a character position, triple click or drag is a Playwright code snippet. A ref click on the textbox lands at the centre of the editor, usually below a short fixture, and places no caret. app_context.md line 19 allows coordinate input "through the browser tool", but line 26 says "Script may be used for exactly two things", and a strict judge may refuse the code snippet.
- Fix: name the coordinate mouse snippet explicitly as allowed real input in app_context.md, or add `--caps=vision` to the MCP args.

## 4. AMBIGUOUS (low) - cw_grapheme_navigation_and_deletion (also cw_mouse_selection when confirming via Find)

- Sentence: "Shift+Arrow must select it whole, confirmed by the copied or highlighted text."
- Golden: `solution/app/src/style.css:21-22` with `custom-editor.js:1224-1226`. A span that is both selected and a Find hit gets class `selection find-hit`; `.find-hit` is declared later, so its background wins.
- Judge would observe: the fixture is pasted from Find, so the Find query equals the whole line and the whole line is a Find hit. The selected emoji or accented letter has the same brown background as the rest of the line (only the text colour differs), so a judge reading the highlight from a screenshot sees no distinct selection. The copy route still works.
- Fix: move the `.selection` rule after `.active-hit` in style.css, or tell the judge to empty Find after pasting the fixture.

## Traced clean

- Render gate cw_authored_custom_editor_run: typing, Ctrl+A and Backspace, and re-editing trace clean in the editor (`:310-314`, `:348-351`). Run itself goes through `runtime`, which was out of scope and not read.
- Constraints gate cw_custom_document_surface: focus is the non-editable div at `:19`; no listed root marker classes on it or on `.codehost`.
- Constraints gate cw_shared_saved_record: `app.tsx:62-76` save and `:52-61` open; server not read.
- cw_custom_typing_and_line_join: `:629-651`, `:653-674`, undo `:226-231`.
- cw_caret_navigation_and_line_numbers: `:771-808`; the intended column survives the short line because Up/Down never write `preferredCol`.
- cw_grapheme_navigation_and_deletion: `:880-918` use `Intl.Segmenter`; behaviour is correct (see problem 4 for the highlight only).
- cw_selection_replace_and_paste_undo: `:566-618`; a paste is one `pushUndo`.
- cw_block_indent_undo: `:839-862`; a selection ending at column 0 excludes the third line; redo on Ctrl+Y and Ctrl+Shift+Z (`:294-304`).
- cw_caret_kept_in_view: `:1141-1156`, with `style.css:13-17` (`overflow:auto`, `white-space:pre`, sticky gutter). Note only: the caret blinks to opacity 0 for half of each second (`style.css:18,20`), so a single screenshot can miss it; the DOM rect is still readable.
- cw_long_line_editing: no wrapping (`style.css:13,15,17`); End reveals the tail; click mapping at `:521-550`.
- cw_multi_caret_typing_atomic: `:588-606` and the typing group `:570-576` make MULTI one undo step; the snapshot keeps all carets.
