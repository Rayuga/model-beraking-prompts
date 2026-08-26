# Data and application shape

Seed the app from `/assets/workbook_seed.json` on first startup. The seed file
contains one workbook named **Northwind Operations Plan** with a sheet named
**Plan**. Starting from an empty SQLite database must create the seeded workbook
and its first revision. Starting again must not duplicate the workbook or
revision.

## Required stack

- One Node.js web app listening on `0.0.0.0:${PORT:-3000}`.
- SQLite as the system of record. Store the database inside `/app` at the path
  documented in `APP_MANIFEST.md`.
- No external database or hosted spreadsheet service.
- `package.json` must expose a working `npm start` command.
- Put `APP_MANIFEST.md` beside `package.json` with a fenced `bash start` block,
  the SQLite file path (using `.db`, `.sqlite`, or `.sqlite3`), and the main
  workbook and revision API routes.

## Custom spreadsheet surface

The workbook grid must be built from scratch. Do **not** use `<textarea>`,
`<input>` as every cell's editing surface, `contenteditable`, Handsontable,
AG Grid, Luckysheet, x-spreadsheet, HyperFormula, SheetJS as the calculation
engine, or another spreadsheet/grid widget for the editable grid.

Small controls outside the grid, such as a formula bar, name box, find/replace
inputs, or dialogs, are allowed. The app must own the workbook model, selection,
keyboard handling, clipboard handling, formulas, undo/redo, and save behavior.
