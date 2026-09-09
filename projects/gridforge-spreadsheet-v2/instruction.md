# GridForge

I want GridForge to be a shared browser spreadsheet for our operations team.
We use the Northwind Operations Plan to work through quantities, costs, and
ownership together. People need to make quick edits, see what colleagues are
working on, and recover an earlier version when something goes wrong.

Please build the editing experience and the server that saves our work. The
notes in `/instructions/` describe the rest of what we need:

- `overview.md` covers our starting workbook and where the app will run.
- `spreadsheet.md` covers working with cells and formulas.
- `collaboration.md` covers sharing a workbook with colleagues.
- `storage.md` covers saving and recovering work.
- `interface.md` covers finding your way around the page.

The sample workbook is in `/assets/workbook_seed.json`. The delivered app
should serve its resources locally and run with the dependencies provided in
the image.

Put the app in `/app`, with `npm start` serving port `3000`. Leave an
`APP_MANIFEST.md` beside `package.json` so we can start it and locate its
SQLite database.
