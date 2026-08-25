# GridForge overview

GridForge is a browser spreadsheet used for operations planning. The first
workbook is Northwind Operations Plan and its first sheet is Plan.

## Starting data

- Seed from `/assets/workbook_seed.json` when the SQLite database is empty.
- Create the workbook and its first revision exactly once.
- Starting the app again must preserve changes and must not duplicate seed
  records or revisions.

## Shape of the application

- Run one Node.js web application on `0.0.0.0:${PORT:-3000}`.
- Use SQLite as the system of record. The database stays inside `/app`.
- Do not use an external database or hosted spreadsheet service.
- `package.json` needs a working `npm start` command.

## The spreadsheet surface

Build the editable grid yourself. Do not use a textarea, `contenteditable`, an
input for every cell, Handsontable, AG Grid, Luckysheet, x-spreadsheet,
HyperFormula, SheetJS as the calculation engine, or another spreadsheet/grid
widget.

Small inputs outside the grid are fine: the formula bar, name box, find and
replace fields, dialogs and similar controls. The app still owns the workbook
model, selection, keyboard and clipboard handling, formulas, undo/redo and
saving.

## APP_MANIFEST.md

Put `APP_MANIFEST.md` beside `package.json`. Include:

- a non-empty fenced block tagged `bash start`
- the SQLite file path, using a `.db`, `.sqlite` or `.sqlite3` filename
- at least two of the main `/api/...` routes

For example:

```bash start
npm start
```
