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

Small controls outside the grid, such as a formula bar, search/filter inputs,
or dialogs, are allowed. The app must own the workbook model, selection,
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
- Sort a rectangular data range by a selected column.
- Filter rows by a text value and later clear the filter without deleting data.

## Formulas

Cells beginning with `=` are formulas. Preserve the raw formula for editing and
persistence, and show the evaluated value in the grid.

Support:

- Arithmetic operators `+`, `-`, `*`, `/`, and parentheses.
- Cell references such as `A1` and `D12`.
- Ranges such as `A1:A10`.
- Functions `SUM`, `AVG`, `MIN`, `MAX`, and `COUNT`.
- Recalculation when referenced cells change.
- Visible errors for invalid formulas, circular references, and division by
  zero.

## Persistence and revisions

Saving changed workbook content writes to SQLite and creates a new revision.
Saving unchanged content must not create a duplicate revision. Reloading the
page must show the last saved workbook, including raw formulas and evaluated
values. Unsaved edits should be marked dirty and must not become saved merely
because the page reloads.

Show a revision history with revision number and timestamp. Users must be able
to preview and restore a prior revision without corrupting the saved history.

## Conflict safety

Every workbook save must include the revision number that the browser started
editing from. If another tab or request has already saved a newer revision, the
older tab must be refused with a visible conflict message and must not overwrite
the newer workbook.

The server must enforce this rule. Do not rely only on a disabled Save button,
client-side checks, hidden fields, or browser storage. A request with a stale
base revision, an unknown workbook id, or a mismatched workbook id must be
rejected without changing the stored workbook.

## Interface expectations

Use labels and controls that are discoverable by intent. Nothing should require
a hidden route, magic element id, or external instructions to use. The app
should include:

- A workbook title or workbook list showing the seeded workbook.
- A custom grid area.
- Save, undo, redo, formula editing, fill, sort, filter, clear filter, and
  revision history controls.
- Visible errors for invalid formulas, rejected saves, and invalid actions.

The product is judged by behavior, not visual polish, but the spreadsheet
should be usable in a normal browser.
