# PatchPad follow-up context

This file records possible follow-up work. It is not part of the current task
brief or scoring contract. Move an item into the task instructions only when
its golden implementation and deterministic verifier are added together.

Potential advanced editor work:

- Indent or outdent every line touched by a multi-line selection with Tab and
  Shift+Tab.
- Support PageUp and PageDown while keeping the intended cursor column.
- Support familiar whole-word deletion shortcuts with Ctrl/Cmd+Backspace and
  Ctrl/Cmd+Delete.
- Let keyboard selections extend, shrink, and reverse direction without losing
  their original anchor.
- Extend an existing selection with Shift+Click.
- Apply clipboard operations consistently across active carets.

Avoid browser-dependent checks such as IME composition, drag-and-drop text, or
pixel-specific soft wrapping unless they can be made stable in the Oracle.
