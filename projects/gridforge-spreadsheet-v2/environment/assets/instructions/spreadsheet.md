# Working with the sheet

Our plan needs room to grow: give us at least 80 rows and 20 columns, A to T.
Use familiar row and column headers, a formula bar, and a clear indication of
the selected cells, saved revision, and whether there are unsaved edits.

People should be able to move around and edit with a mouse or keyboard, select
a cell or rectangular area, drag in either direction, and extend a selection.
Copying, cutting, pasting, and undo/redo should feel like a spreadsheet. We
often bring in tables as TSV or CSV, so pasted rows and columns should land
in the corresponding cells.

We also need fill, find and replace, and a name box for jumping to a cell or
selecting an area. Filling should continue number patterns and adjust relative
formula references. A complete edit, paste, fill, or replace-all should be one
action to undo or redo.

For calculations, support formulas beginning with `=`, arithmetic,
parentheses, cell and range references, and `SUM`, `AVG`, `MIN`, `MAX`,
and `COUNT`. People will mix values, cells, and ranges in these functions.
Show the calculated result in the grid while keeping the original formula
available for editing and saving, and update dependent cells when inputs
change.

While someone builds a formula, suggest functions just below the cell they
are editing and let them pick references by pointing at cells or areas. Keep
those references easy to see. Until they type an operator or argument
separator, picking again should replace their previous reference; typing then
continues after the reference.

Invalid syntax, division by zero, and circular references should produce
understandable errors. Correcting a formula should let the calculation recover.
