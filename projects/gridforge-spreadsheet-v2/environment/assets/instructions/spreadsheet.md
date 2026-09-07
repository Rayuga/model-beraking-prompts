# Working with the sheet

Open the seeded workbook as a familiar spreadsheet with row and column headers,
a formula bar, selection details, the saved revision, and a clear saved or
unsaved state.

Provide at least 80 rows and 20 columns, from A to T.

Support common spreadsheet editing and navigation with the mouse and keyboard,
including selection, clipboard actions, and undo/redo. Pasted tabular data in TSV or CSV form
should fill the matching area.

Selections should behave naturally for a cell or rectangular area, including
dragging in either direction and extending an existing selection.

Include the everyday tools people expect from a spreadsheet: filling values or
formulas across an area, finding and replacing cell text, and using a name box
to jump to a cell or select an area. Number patterns and relative formula
references should continue naturally during a fill.

Undo and redo should treat a complete edit, paste, fill, or replace-all as one
spreadsheet action.

## Formulas

Formulas start with `=`. Keep the original formula available for editing and
saving while showing its calculated result in the grid. Support normal
arithmetic, parentheses, cell and range references, and `SUM`, `AVG`, `MIN`,
`MAX`, and `COUNT`. Functions should accept the usual combinations of values,
cells, and ranges. Calculated cells should update when their inputs change.

Formula editing should offer useful function suggestions near the cell being
edited and let people point to cells or areas in the grid to build an
expression. Keep referenced areas easy to recognize and handle the formula
caret, operators, and arguments in the way people expect from a spreadsheet.

Show understandable errors for invalid formulas, circular references, and
division by zero, and allow the sheet to recover when the formula is corrected.

Keep function suggestions directly below the cell being edited. Picking a
new reference replaces the previous picked reference until an operator or
argument separator is entered; subsequent typing continues after the reference.
