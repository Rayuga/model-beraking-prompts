# Docketlight-style setup and observations

Only the three failed Oracle criteria are reformatted. All weights and outcome checks remain.

## tab_indentation_and_reversal

### Earlier

Feature metadata: feature=editing; sub_feature=tab_and_shift_tab_indentation; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Record each checkpoint as plain text before issuing the next editing command; do not assemble all results only after the full sequence.
1. Through the real mouse and keyboard, focus the seeded Timeline line and press Home. Verify the caret is at the start of that line, the editor has focus, and its exact text is Timeline. Record the adjacent lines.
2. Press Tab once. Read and record the exact resulting line immediately. Require a nonempty leading prefix made only of spaces or tabs, followed by unchanged Timeline, with editor focus retained. Accept the app's indentation width.
3. Press Shift+Tab once. Read and record exactly Timeline immediately.
4. Press Undo once. Read and record the exact indented line from step 2 immediately.
5. Press Redo once. Read and record exactly Timeline immediately.
6. Require the adjacent lines unchanged at every checkpoint. Reload without saving and require Timeline unchanged in the saved report.
Browser focus traversal, a missing indentation, altered non-whitespace content, an incorrect reversal, or an additional editing command to repair a failed result fails. A judge measurement exception is handled by the prompt's invalid-attempt procedure; it is not evidence that the app performed the wrong edit.

### Now

Feature metadata: feature=editing; sub_feature=tab_and_shift_tab_indentation; kind=graded; depends_on=seed_document_integrity.
Setup: open the current saved report and use ordinary visible navigation, Find or a real mouse click to focus the seeded Timeline line. Collapse any selection and use Home to place the caret at its start. Confirm the line is exactly Timeline and record the unchanged adjacent lines. The route used to reach this state is not graded.
Graded observations, all required:
1. Press Tab once. Require editor focus to remain and the line to gain a nonempty prefix of spaces or tabs followed by unchanged Timeline. Accept the app's indentation width. Read and record the exact indented line before continuing.
2. Press Shift+Tab once and record exactly Timeline. Press Undo once and record the exact indentation from observation 1. Press Redo once and record exactly Timeline again. Capture each result before the next command.
3. The adjacent lines remain unchanged throughout. Reload without saving and require the saved report to retain Timeline with no indentation.
Judge the observed text, focus and reversals. Extra editing commands to repair an incorrect result fail. Handle a demonstrated judge measurement/setup error with the prompt's bounded invalid-attempt procedure; never infer a pass from missing evidence.

## selection_autoscroll_exact_offscreen_range

### Earlier

Feature metadata: feature=selection; sub_feature=offscreen_autoscroll; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Test both real mouse selection and real keyboard selection. The required outcome is a selection beginning at the start of the ALPHA-0010 logical line and reaching through ALPHA-0060 in document order while the visible document region scrolls.
1. Navigate visibly to ALPHA-0010, with ALPHA-0060 initially below the visible region. Identify the actual scroll region: editor, ancestor container or page. Measure the rendered start of the ALPHA-0010 text including padding and horizontal scroll. Prefer a point at that text start. A gutter is also acceptable if the app supports beginning a text selection there; verify its resulting anchor is the start of the requested logical line. Do not fail solely because a supported selection began in the gutter.
2. Press the primary mouse button once at that start and drag to the lower scrolling boundary, keeping the pointer horizontally over the document area. Hold at or just beyond the boundary, within the browser viewport, for up to 20 seconds until ALPHA-0060 is selected; release once. Do not substitute wheel scrolling, synthetic events or programmatic scroll changes.
3. Copy once from the focused editor and await the real clipboard update. Record the scroll change and selected text boundaries. Require newly revealed document content, actual selection-driven scrolling, a copied range starting with the full ALPHA-0010 line, and ALPHA-0060 included after it. A stationary viewport, a wrong anchor, a range ending at the initial visible edge, or merely copying the whole document fails.
4. Clear the selection and return to the start of ALPHA-0010 with ALPHA-0060 offscreen again. Confirm editor focus, the starting logical line, and the start-of-line caret before issuing the next keys. Hold Shift, press ArrowDown exactly 50 times, then Shift+End. Copy once and require the exact document slice from the start of ALPHA-0010 through the end of ALPHA-0060. Require selection-driven scrolling to reveal the target and keep the caret visible.
Record the mouse and keyboard evidence separately. Either leg may scroll the editor, an ancestor or the page. The complete document must remain unchanged. Perform both legs; success in one does not establish the other.

### Now

Feature metadata: feature=selection; sub_feature=offscreen_autoscroll; kind=graded; depends_on=seed_document_integrity.
Setup: use ordinary visible navigation or Find to bring ALPHA-0010 into view with ALPHA-0060 initially below the visible region. Record the document's exact lines from the start of ALPHA-0010 through the end of ALPHA-0060. Identify the actual scroll region: editor, ancestor or page. Establish the start of the ALPHA-0010 line as the selection anchor. Use its rendered text start or a supported gutter gesture; the app's layout and setup route are not graded.
Graded observations, all required:
1. From that anchor, hold the primary mouse button and drag to the lower boundary of the visible document region, keeping the pointer horizontally over the document area. Hold there for up to 20 seconds while the region scrolls until ALPHA-0060 is selected, then release once. Copy once from the focused editor. Require actual selection-driven scrolling with newly revealed content and a copied range beginning with the full ALPHA-0010 line and including ALPHA-0060 afterward. The editor, an ancestor or the page may scroll. Synthetic events, separate wheel scrolling, programmatic scroll changes, a stationary viewport, a wrong anchor or a whole-document copy fail this observation.
2. As setup for the keyboard leg, clear the selection and return to the same start-of-line anchor with ALPHA-0060 offscreen again. Confirm focus and the caret before acting. Hold Shift, press ArrowDown exactly 50 times, then Shift+End. Copy once. Require exactly the recorded document slice through the end of ALPHA-0060, selection-driven scrolling and a visible final caret.
3. The full document remains unchanged. Record mouse and keyboard results separately; both legs must work. Do not reject a successful selection solely because the supported starting point was in a gutter or because the app uses a different scroll container.

## clipboard_external_multiline_internal_exact

### Earlier

Feature metadata: feature=clipboard; sub_feature=external_multiline_and_internal_cut; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Record each exact text and clipboard checkpoint before the next mutation.
1. Put the exact external payload "EXTERNAL-A\nEXTERNAL-B\tCELL\nEXTERNAL-C" on the real browser clipboard, using actual newline and tab characters. With the editor focused at the document end, insert one newline and press Ctrl/Cmd+V once. Await insertion and require exactly those three final logical lines, preserving the tab in EXTERNAL-B. Record the full current document in test variables.
2. Establish the caret in the second inserted line, EXTERNAL-B followed by a tab and CELL. If the caret is at the end of EXTERNAL-C, press ArrowUp once and verify the target line; otherwise navigate visibly to that exact second line. Confirm editor focus. Press Home then Shift+End and copy once. Await the clipboard update and record exactly "EXTERNAL-B\tCELL". Do not proceed with Cut if the clipboard instead contains EXTERNAL-C, the entire payload or an earlier value. Inspect the setup and focus first; an actual incorrect selection after correctly targeted actions fails.
3. Press Ctrl/Cmd+X once and await the edit. Record the final three lines and require exactly ["EXTERNAL-A", "", "EXTERNAL-C"], with the earlier document unchanged.
4. Press Undo once. Read and record restoration of the complete document from step 1, including the exact tabbed second line.
5. Confirm editor focus without clicking text or changing the selection. Press Ctrl/Cmd+A once, then Ctrl/Cmd+C once. Await a new clipboard result and compare it byte-for-byte with the complete current document, from its original first line through EXTERNAL-C. An old second-line clipboard value is not evidence of a new Copy.
6. Reload without saving and require the saved baseline with no EXTERNAL markers.
Use real keyboard clipboard commands. Direct text injection, calling application handlers, partial cut/Undo, or missing whole-document selection fails. Preserve the required single Cut and single Undo; do not repair an incorrect result with additional edits.

### Now

Feature metadata: feature=clipboard; sub_feature=external_multiline_and_internal_cut; kind=graded; depends_on=seed_document_integrity.
Setup: record the saved baseline. Through ordinary visible navigation or Find, focus the editor at the end of the final logical line and insert one newline. Put the external payload EXTERNAL-A, EXTERNAL-B followed by a tab and CELL, and EXTERNAL-C on the real browser clipboard as three lines with actual newline/tab characters. Verify this payload is ready and the editor has focus. Setup navigation is not graded.
Graded observations, all required:
1. Press Ctrl/Cmd+V once and await insertion. Require exactly the three final lines ["EXTERNAL-A", "EXTERNAL-B\tCELL", "EXTERNAL-C"] with no other change. Store the complete resulting document in test variables.
2. Navigate visibly to the second inserted line, EXTERNAL-B followed by a tab and CELL. An ArrowUp from the end of EXTERNAL-C or Find is valid setup. Confirm the target line and editor focus before selecting it with Home, Shift+End. Copy once and await exactly "EXTERNAL-B\tCELL" on the clipboard. If focus or the target was not established, correct setup first; do not Cut EXTERNAL-C or stale clipboard content.
3. With that selection established, Cut once. Await and record the three final lines exactly ["EXTERNAL-A", "", "EXTERNAL-C"], with all preceding text unchanged. Undo once and require the entire document from observation 1 restored, including the tabbed second line.
4. Confirm editor focus, then use Ctrl/Cmd+A once and Ctrl/Cmd+C once. Await a new clipboard result and require byte-for-byte equality with the complete current document, from its original first line through EXTERNAL-C.
5. Reload without saving and require the saved baseline with no EXTERNAL markers.
Each mutation must be observed before the next. Use real keyboard clipboard commands. Direct text injection, application handlers, an incorrect Cut/Undo result, or incomplete whole-document selection fails. Preserve the single Cut and single Undo; do not repair an app failure with additional edits.
