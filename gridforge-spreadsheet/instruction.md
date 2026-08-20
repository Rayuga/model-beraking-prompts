# Task: GridForge Spreadsheet

Build **GridForge**, a browser-based spreadsheet engine for operations planning.
It is not a CRUD dashboard. The core deliverable is a custom spreadsheet grid
with formula evaluation, range editing, saved workbook revisions, and
conflict-safe persistence.

## Data

Seed the app from `/assets/workbook_seed.json` on first startup. The seed file
contains one workbook named **Northwind Operations Plan** with a sheet named
**Plan**. Starting from an empty SQLite database must create the seeded workbook
and its first revision. Starting again must not duplicate the workbook or
revision.

## Required stack

- One Node.js web app listening on `0.0.0.0:${PORT:-3000}`.
- SQLite as the system of record.
- No external database or hosted spreadsheet service.
- `package.json` must expose a working `npm start` command.
- Put `APP_MANIFEST.md` beside `package.json` with a fenced `bash start` block,
  the database path, and the main API routes.

## Custom spreadsheet surface

The workbook grid must be built from scratch. Do **not** use `<textarea>`,
`<input>` as every cell's editing surface, `contenteditable`, Handsontable,
AG Grid, Luckysheet, x-spreadsheet, HyperFormula, SheetJS as the calculation
engine, or another spreadsheet/grid widget for the editable grid.

Small controls outside the grid, such as a formula bar, name box, find/replace
inputs, or dialogs, are allowed. The app must own the workbook model, selection,
keyboard handling, clipboard handling, formulas, undo/redo, and save behavior.

## Spreadsheet behavior

The app opens the seeded workbook and shows row numbers, column letters, a
formula bar or selected-cell readout, saved revision, and whether the workbook
is saved or dirty.

Users must be able to:

- Click or keyboard-focus cells and edit values.
- Move through cells with Arrow keys, Tab, Shift+Tab, Enter, and Shift+Enter.
- Select one cell or a rectangular range with mouse or keyboard.
- Copy, cut, paste, and clear rectangular ranges.
- Paste tab-separated rows and columns copied from another app.
- Undo and redo edits using visible controls and keyboard shortcuts.
- Fill a selected range downward or sideways using a visible fill control or
  drag handle.
- Find matching cell text and replace matches using visible controls.
- Jump to a cell or select a rectangular range by entering an address in the
  name box.

## Collaboration and edit history

GridForge has a small seeded-user login so edits can be attributed to people.
Users should be able to sign in as one of the seeded users, edit the workbook,
and see who last changed a selected cell.

Track edit history at the cell level. When a cell value changes, record the
previous value, the new value, the signed-in user, and the time of the change.
Users should be able to inspect the history for a selected cell.

When two users edit different cells from the same saved workbook version, both
changes should be kept. When two users edit the same cell from the same saved
workbook version, the later save should be rejected with a visible conflict
message instead of overwriting the earlier user's edit.

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
  being edited.
- Visible errors for invalid formulas, circular references, and division by
  zero.

## Persistence and revisions

GridForge should autosave workbook changes after the user pauses editing. Users
should not need to press Save for ordinary edits. The UI should show whether
changes are dirty, saving, saved, or failed to save. A visible Save control can
still be provided as a manual "save now" action.

Saving changed workbook content writes to SQLite and creates a new revision.
Saving unchanged content must not create a duplicate revision. Reloading the
page must show the last saved workbook, including raw formulas and evaluated
values. Edits that have not finished saving should not be presented as saved.

Show a revision history with revision number and timestamp. Users must be able
to preview and restore a prior revision without corrupting the saved history.
Autosaved changes should appear in revision history just like manual saves.

## Conflict safety

Every workbook save must include the revision number that the browser started
editing from. The server should compare what changed since that version. If a
newer save changed different cells, keep both users' changes. If a newer save
changed the same cell, reject the later save with a visible conflict message and
do not overwrite the earlier user's cell value.

The server must enforce these rules. Do not rely only on a disabled Save
button, client-side checks, hidden fields, or browser storage. A request with an
unknown workbook id, a mismatched workbook id, or an invalid base revision must
be rejected without changing the stored workbook.

## Interface expectations

Use labels and controls that are discoverable by intent. Nothing should require
a hidden route, magic element id, or external instructions to use. The app
should include:

- A workbook title or workbook list showing the seeded workbook.
- A custom grid area.
- Save, undo, redo, formula editing, fill, find, replace, name-box navigation, and
  revision history controls.
- Visible errors for invalid formulas, rejected saves, and invalid actions.

The product is judged by behavior, not visual polish, but the spreadsheet
should be usable in a normal browser.
