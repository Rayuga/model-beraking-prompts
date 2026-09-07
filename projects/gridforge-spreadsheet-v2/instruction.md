# GridForge spreadsheet

I want to build GridForge, a browser spreadsheet for an operations team. It
should feel like a small real spreadsheet, not a CRUD table with editable
fields.

The details are in `/instructions/`. Read all of these before starting:

- `overview.md` - what we are building and the allowed stack
- `spreadsheet.md` - grid editing, formulas, clipboard, fill and find/replace
- `collaboration.md` - people, live views, attribution and save safety
- `storage.md` - SQLite, autosave and revision history
- `interface.md` - the controls and feedback people need to see

These files are one brief split by topic. None of them is optional.

Seed data is under `/assets/workbook_seed.json`. Nothing in the finished app
should depend on somebody knowing a hidden route, request shape or element id.
The workspace is offline while you build. Use the supplied seed and the
dependencies already available in the image; do not install or fetch anything.
Put the finished app in `/app` and start it with `npm start` on port `3000`.
Include `APP_MANIFEST.md` with the start command and SQLite database path.
