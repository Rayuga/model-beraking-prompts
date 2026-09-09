# Our starting point

The team already has a workbook called Northwind Operations Plan, with a sheet
called Plan, in `/assets/workbook_seed.json`. Please bring that into SQLite
on the first start, along with its first saved revision. When we restart the
server, our existing work and history should still be there, without another
copy of the sample workbook.

We will run this as one Node.js app, listening on `0.0.0.0` and the `PORT`
environment variable, or port 3000 if it is unset. SQLite will hold the saved
workbooks inside `/app`; we don't have an external database or a hosted
spreadsheet service. Express 5.2.1 is provided under `/opt/gridforge-deps`.
You may use these modules or install dependencies during development. Include
installed runtime dependencies with the delivered app so npm start needs no
package download.

I want us to own the spreadsheet's editing and calculation behavior. Build
the grid and workbook model ourselves, including selection, keyboard and
clipboard handling, formulas, undo/redo, and saving. The editable grid should
not use a textarea, an input for every cell, contenteditable, or a ready-made
spreadsheet widget. That includes Handsontable, AG Grid, Luckysheet,
x-spreadsheet, HyperFormula, and SheetJS as a calculation engine. Ordinary
inputs for the formula bar, name box, search, and dialogs are fine.

For whoever runs this later, keep `package.json` and `APP_MANIFEST.md` in
`/app`. The manifest should give the working start command in a fenced
`bash start` block, one absolute SQLite file path under `/app` ending in
`.db`, `.sqlite`, or `.sqlite3`, and the main workbook and revision API
routes. All resources used by the running app should be served locally.
