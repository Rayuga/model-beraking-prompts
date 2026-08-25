# Spreadsheet behaviour

Open the seeded workbook directly. Show row numbers, column letters, the raw
value or formula for the selected cell, the saved revision and whether the
workbook is dirty, saving, saved or failed.

## Editing the grid

- Click or keyboard-focus a cell and edit its value.
- Move with Arrow keys, Tab, Shift+Tab, Enter and Shift+Enter.
- Select one cell or a rectangular range with the mouse or keyboard.
- Copy, cut, paste and clear rectangular ranges.
- Multi-row clipboard data should fill a matching rectangle. Support the
  common tab-separated and comma-separated forms.
- A committed cell edit is one undo step, not one step per typed character.
- Redo should work until a new edit replaces the redo branch.

## Fill and find

- Fill a selected range down or to the right with a visible control or handle.
- Continue numeric sequences from their leading values.
- Shift relative cell references when formulas are filled.
- Treat one complete fill as one undoable action.
- Find matching cell text and move through later matches, wrapping when needed.
- Replace the current match or every match with visible controls.
- Treat Replace All as one undoable action.
- Let somebody type a cell or rectangular address in the name box to jump to
  and select it. A jump to an off-screen cell should scroll it into view.

## Formulas

- A value beginning with `=` is a formula. Keep the raw formula for editing and
  persistence while the grid shows the result.
- Support `+`, `-`, `*`, `/`, parentheses, cell references and ranges.
- Support `SUM`, `AVG`, `MIN`, `MAX` and `COUNT`.
- Functions accept one or more comma-separated arguments. Each argument may be
  a literal value, a cell reference or a range.
- While a function name is being typed, show matching functions in a dropdown
  directly below the cell being edited.
- While editing a formula, let the user insert a cell reference by clicking a
  cell and a range reference by dragging across cells. Keep those referenced
  cells visibly marked during the edit.
- If a reference is already selected in the raw formula, clicking another cell
  replaces it. Without an operator or comma, a new reference also replaces the
  previous inserted reference instead of producing invalid concatenated text.
- Recalculate dependants when an input changes.
- Show understandable errors for invalid formulas, circular references and
  division by zero, and recover after the bad formula is corrected.
