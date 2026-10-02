# Editing code

Build the code editing surface with your own DOM, canvas or SVG text model. Do not use a textarea, input or contenteditable element as the document surface, and do not use CodeMirror, Monaco, Ace, ProseMirror, TipTap, Quill, Slate, Draft.js or another ready-made editor. A small input solely for keyboard or clipboard plumbing is fine. Parsing, highlighting and formatting libraries are allowed; the editing surface and its caret, selection, changes and undo behavior are yours to implement.

Show numbered logical lines and the current line and column. Support normal typing, paste, new lines, Backspace, Delete, arrows, Home and End. Moving vertically should remember the intended column when a shorter line temporarily clamps it. Emoji and decomposed accented letters should move and delete as complete visible characters.

Use ordinary mouse actions to put the caret in text, select a word with a double click, select a logical line with a triple click, and drag a range. Copying a selection with the usual keyboard shortcut should work. The editor must keep a long unwrapped line horizontally reachable so text near its end can be selected and edited. Tab and Shift+Tab should indent and outdent selected lines as one undoable action; a selection ending at the start of the next line should leave that next line alone.

Allow Alt+Click or Ctrl/Cmd+Click to add carets on different lines. Typing, Backspace and Delete affect all of them. A continuous multi-caret typing burst is one Undo action; Redo restores it. Undo and Redo also work from visible controls and normal keyboard shortcuts.

Offer Find, next and previous matches, Replace current and Replace all for literal case-sensitive text. Navigation wraps at the ends. Replace all is one Undo action, and a new edit after Undo clears Redo.

Colour code according to what the tokens are, using visibly distinct treatments: JavaScript keywords, function names at their declaration and calls, strings, numbers and comments; HTML tag names, attribute names, quoted values and comments. Function names should not be coloured as keywords or strings. Choose your own palette; no exact RGB value is required. Colouring is for the editor only and must not change the saved source or preview result.

Provide Format document for valid JavaScript and complete HTML. It should break a compact one-line program into readable lines, use consistent two-space nesting and preserve strings, comments and runtime meaning. Formatting twice should not change the result again. One Undo restores the whole pre-format source; Redo reapplies it. For a syntactically invalid draft, show a useful formatting error without losing the draft. A standalone formatter is allowed.

Include title and filename fields, Run, Stop, New, Save, a saved library and history inspection. Label controls clearly and show keyboard focus.
