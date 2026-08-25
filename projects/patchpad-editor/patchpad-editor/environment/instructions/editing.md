# Editing

The editor opens the seeded document and supports normal text entry, new lines,
Backspace, Delete, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, and End.
Cursor movement must remain predictable across short and long logical lines.

Support standard mouse and keyboard selection, including word, line, range,
and full-document selection, and replace selected text by typing or pasting.
Selection must continue beyond the visible editor while the view scrolls to
keep extending it through the document.

Users can copy selected text, cut selected text, and paste clipboard text copied
from inside PatchPad or another application or browser tab. Preserve multiline
and tabbed clipboard text. Cutting and pasting are each one undoable edit.

Provide Undo and Redo as visible controls and through Ctrl/Cmd+Z and Ctrl/Cmd+Y
or Ctrl/Cmd+Shift+Z. A contiguous run of typed characters at one caret, typing
that replaces a selection, and a Replace All operation are each one undoable
edit. Separate typing runs remain separate undo steps, and a new edit after an
undo discards the redo path.

Users can create multiple carets with Alt+Click or Ctrl/Cmd+Click. Typing,
Backspace, and Delete apply across all active carets, and one undo reverses the
whole multi-caret edit.
