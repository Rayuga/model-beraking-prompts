# Editing

Support the normal things people expect from a text editor: typing, new lines,
Backspace, Delete, arrow keys, Home and End. Show line numbers and the current
cursor position.

Include familiar keyboard behavior for moving or selecting by words, using Tab
and Shift+Tab for indentation, and opening Find from the keyboard. Find results
should be reachable in both directions without going back to the mouse.
Escape from the editing area should focus the Find input so people can use
Tab and Shift+Tab to move through the surrounding controls again.
When the Find input has focus, Escape should return focus to the editing area
without changing the current document selection, so people can copy the
selected match or continue editing it from the keyboard.

For word shortcuts, either familiar rightward convention is fine: the end of
the current word or the start of the next word. Holding Shift selects the same
span; moving left goes back to the previous word's start.

Support emoji and accented text as complete visible characters when moving,
selecting, or deleting.

Mouse and keyboard selection should work for words, lines, larger ranges, and
the whole document. Selection should continue naturally when it moves beyond
the visible part of a long report. Typing or pasting over a selection should
replace it.

Support copy, cut, and paste from PatchPad and from other applications, including
multiline and tabbed clipboard text. Provide visible Undo and Redo controls as
well as the usual keyboard shortcuts. Undo and Redo should behave like they do
in familiar document editors such as Google Docs or Word.

Allow multiple carets using Alt+Click or Ctrl/Cmd+Click. Typing, Backspace, and
Delete should affect every active caret.

Keep uninterrupted typing at one location together in Undo. Replacing a
selection is one action; moving to another location starts a new action, and
a new edit clears Redo.
