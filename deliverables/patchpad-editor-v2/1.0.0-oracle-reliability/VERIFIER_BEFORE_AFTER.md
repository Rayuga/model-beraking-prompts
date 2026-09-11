# Oracle reliability changes

All IDs, weights, verdict types and required editing operations are preserved.

## tab_indentation_and_reversal

### Before

Feature metadata: feature=editing; sub_feature=tab_and_shift_tab_indentation; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Use the real mouse and keyboard to focus seeded logical line 5, whose exact value is Timeline, and press Home. Press Tab exactly once. Require focus to remain in the custom editor and line 5 to gain a nonempty leading indentation made only of spaces or tabs, with Timeline itself byte-for-byte unchanged. Accept the app's indentation width without imposing a fixed character count. Record that exact indented line. Press Shift+Tab exactly once and require line 5 to return exactly to Timeline. Press Undo exactly once and require the exact recorded indented line to return; press Redo exactly once and require exactly Timeline again. Adjacent lines must remain unchanged throughout. Reload without saving and require line 5 to remain Timeline. Browser focus traversal, insertion away from the line start, non-whitespace content changes, or multiple Tab/Shift+Tab presses fail.

### After

Feature metadata: feature=editing; sub_feature=tab_and_shift_tab_indentation; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Record each checkpoint as plain text before issuing the next editing command; do not assemble all results only after the full sequence.
1. Through the real mouse and keyboard, focus the seeded Timeline line and press Home. Verify the caret is at the start of that line, the editor has focus, and its exact text is Timeline. Record the adjacent lines.
2. Press Tab once. Read and record the exact resulting line immediately. Require a nonempty leading prefix made only of spaces or tabs, followed by unchanged Timeline, with editor focus retained. Accept the app's indentation width.
3. Press Shift+Tab once. Read and record exactly Timeline immediately.
4. Press Undo once. Read and record the exact indented line from step 2 immediately.
5. Press Redo once. Read and record exactly Timeline immediately.
6. Require the adjacent lines unchanged at every checkpoint. Reload without saving and require Timeline unchanged in the saved report.
Browser focus traversal, a missing indentation, altered non-whitespace content, an incorrect reversal, or an additional editing command to repair a failed result fails. A judge measurement exception is handled by the prompt's invalid-attempt procedure; it is not evidence that the app performed the wrong edit.

## selection_autoscroll_exact_offscreen_range

### Before

Feature metadata: feature=selection; sub_feature=offscreen_autoscroll; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Navigate visibly to ALPHA-0010 and establish that ALPHA-0060 is below the visible document region. Identify the scrollable region actually used to view the document: it may be the editor, an ancestor container, or the page. Starting at the beginning of the rendered ALPHA-0010 line, use real mouse down and drag to the lower scrolling boundary of that visible region, keeping the horizontal pointer position within the document text area. Keep the primary button held at or just beyond that boundary, within the browser viewport, allowing up to 20 seconds for selection-driven scrolling until ALPHA-0060 enters the selected range; then release once near the right side of the text area. Require newly revealed document content and actual scrolling of the relevant region, and require the selected text, copied with Ctrl/Cmd+C, to begin in the ALPHA-0010 line and include ALPHA-0060 in document order. Do not require a particular element's scrollTop to change. Do not use synthetic events, set scroll positions directly, or use a separate wheel/scroll command to rescue the drag. Clear the selection, return to the beginning of ALPHA-0010 with ALPHA-0060 initially offscreen again, and verify editor focus and the starting position. Hold Shift, press ArrowDown exactly 50 times, then press Shift+End to include the target line. Require selection-driven scrolling to reveal the target and keep the caret visible, and require copied selected text to include both ALPHA-0010 and ALPHA-0060 in order. Scrolling the editor, an ancestor, or the page is acceptable in either leg when caused by the required selection interaction. A stationary visible document region or selection ending at the original visible edge fails. Do not release immediately after the drag move or infer failure from an unperformed gesture.

### After

Feature metadata: feature=selection; sub_feature=offscreen_autoscroll; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Test both real mouse selection and real keyboard selection. The required outcome is a selection beginning at the start of the ALPHA-0010 logical line and reaching through ALPHA-0060 in document order while the visible document region scrolls.
1. Navigate visibly to ALPHA-0010, with ALPHA-0060 initially below the visible region. Identify the actual scroll region: editor, ancestor container or page. Measure the rendered start of the ALPHA-0010 text including padding and horizontal scroll. Prefer a point at that text start. A gutter is also acceptable if the app supports beginning a text selection there; verify its resulting anchor is the start of the requested logical line. Do not fail solely because a supported selection began in the gutter.
2. Press the primary mouse button once at that start and drag to the lower scrolling boundary, keeping the pointer horizontally over the document area. Hold at or just beyond the boundary, within the browser viewport, for up to 20 seconds until ALPHA-0060 is selected; release once. Do not substitute wheel scrolling, synthetic events or programmatic scroll changes.
3. Copy once from the focused editor and await the real clipboard update. Record the scroll change and selected text boundaries. Require newly revealed document content, actual selection-driven scrolling, a copied range starting with the full ALPHA-0010 line, and ALPHA-0060 included after it. A stationary viewport, a wrong anchor, a range ending at the initial visible edge, or merely copying the whole document fails.
4. Clear the selection and return to the start of ALPHA-0010 with ALPHA-0060 offscreen again. Confirm editor focus, the starting logical line, and the start-of-line caret before issuing the next keys. Hold Shift, press ArrowDown exactly 50 times, then Shift+End. Copy once and require the exact document slice from the start of ALPHA-0010 through the end of ALPHA-0060. Require selection-driven scrolling to reveal the target and keep the caret visible.
Record the mouse and keyboard evidence separately. Either leg may scroll the editor, an ancestor or the page. The complete document must remain unchanged. Perform both legs; success in one does not establish the other.

## clipboard_external_multiline_internal_exact

### Before

Feature metadata: feature=clipboard; sub_feature=external_multiline_and_internal_cut; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Put the exact external clipboard payload "EXTERNAL-A
EXTERNAL-B	CELL
EXTERNAL-C" on the real browser clipboard outside the editor. Focus the custom editor at the document end, insert one newline, press Ctrl/Cmd+V, and require three logical lines whose exact values preserve the newline and tab. On the second inserted line use Home then Shift+End and Ctrl/Cmd+C; read the real clipboard and require exactly "EXTERNAL-B	CELL". Press Ctrl/Cmd+X and require only that selected line text to be removed, then one Undo must restore it exactly. Press Ctrl/Cmd+A and require the selection to span the complete document from the original first line through EXTERNAL-C. Reload without saving and verify no EXTERNAL marker persisted. Directly injecting text or calling clipboard handlers fails. After the one Undo has visibly restored the line, confirm editor focus without clicking document text or selecting a search field. Press Ctrl/Cmd+A once, then Ctrl/Cmd+C once and await the clipboard update before reading it; a cached value from the earlier 15-character copy is not a new copy result. Compare the clipboard with the complete current document, not only the EXTERNAL suffix.

### After

Feature metadata: feature=clipboard; sub_feature=external_multiline_and_internal_cut; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Record each exact text and clipboard checkpoint before the next mutation.
1. Put the exact external payload "EXTERNAL-A\nEXTERNAL-B\tCELL\nEXTERNAL-C" on the real browser clipboard, using actual newline and tab characters. With the editor focused at the document end, insert one newline and press Ctrl/Cmd+V once. Await insertion and require exactly those three final logical lines, preserving the tab in EXTERNAL-B. Record the full current document in test variables.
2. Establish the caret in the second inserted line, EXTERNAL-B followed by a tab and CELL. If the caret is at the end of EXTERNAL-C, press ArrowUp once and verify the target line; otherwise navigate visibly to that exact second line. Confirm editor focus. Press Home then Shift+End and copy once. Await the clipboard update and record exactly "EXTERNAL-B\tCELL". Do not proceed with Cut if the clipboard instead contains EXTERNAL-C, the entire payload or an earlier value. Inspect the setup and focus first; an actual incorrect selection after correctly targeted actions fails.
3. Press Ctrl/Cmd+X once and await the edit. Record the final three lines and require exactly ["EXTERNAL-A", "", "EXTERNAL-C"], with the earlier document unchanged.
4. Press Undo once. Read and record restoration of the complete document from step 1, including the exact tabbed second line.
5. Confirm editor focus without clicking text or changing the selection. Press Ctrl/Cmd+A once, then Ctrl/Cmd+C once. Await a new clipboard result and compare it byte-for-byte with the complete current document, from its original first line through EXTERNAL-C. An old second-line clipboard value is not evidence of a new Copy.
6. Reload without saving and require the saved baseline with no EXTERNAL markers.
Use real keyboard clipboard commands. Direct text injection, calling application handlers, partial cut/Undo, or missing whole-document selection fails. Preserve the required single Cut and single Undo; do not repair an incorrect result with additional edits.
