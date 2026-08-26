# Spreadsheet behavior

The app opens the seeded workbook and shows row numbers, column letters, a
formula bar or selected-cell/range readout, saved revision, and whether the
workbook is saved or dirty.

Users must be able to:

- Click or keyboard-focus cells and edit values.
- Move through cells with Arrow keys, Tab, Shift+Tab, Enter, and Shift+Enter.
- Select one cell or a rectangular range with mouse or keyboard, including
  mouse drag and Shift+Click range extension.
- Copy, cut, paste, and clear rectangular ranges.
- Pasting multi-row, multi-column clipboard data using common delimiters should
  populate the corresponding rectangular range.
- Undo and redo edits using visible controls and keyboard shortcuts. Treat each
  committed cell edit as one undoable action rather than undoing its typed
  characters individually.
- Fill a selected range downward or sideways using a visible fill control or
  drag handle. Continue numeric sequences from their leading values and adjust
  relative cell references when formulas are filled. Treat the complete fill as
  one undoable action.
- Find matching cell text, move to subsequent matches, and replace either the
  current match or all matches using visible controls. Treat Replace All as one
  undoable action.
- Jump to a cell or select a rectangular range by entering an address in the
  name box.

## Formulas

Cells beginning with `=` are formulas. Preserve the raw formula for editing and
persistence, and show the evaluated value in the grid.

Support:

- Arithmetic operators `+`, `-`, `*`, `/`, and parentheses.
- Cell references such as `A1` and `D12`.
- Ranges such as `A1:A10`.
- Functions `SUM`, `AVG`, `MIN`, `MAX`, and `COUNT`.
- Function names should appear in a dropdown below the cell being edited while
  typing formulas.
- Formula editing should help users insert cell and range references from the
  grid, and referenced cells or ranges should be visible while a formula is
  being edited. Selecting another cell or range without first entering an
  operator or argument separator should replace the current inserted reference
  instead of concatenating an invalid reference.
- Visible errors for invalid formulas, circular references, and division by
  zero.
