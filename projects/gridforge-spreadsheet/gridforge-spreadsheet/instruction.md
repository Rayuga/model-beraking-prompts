# GridForge spreadsheet

I want to build GridForge, a browser spreadsheet for an operations team. It
needs to feel like a small real spreadsheet, not a CRUD table with editable
fields.

The details are in `/instructions/`. Read all of these before starting:

- `overview.md` — what we are building and the allowed stack
- `spreadsheet.md` — grid editing, formulas, clipboard, fill and find/replace
- `collaboration.md` — people, live views, attribution and save safety
- `storage.md` — SQLite, autosave and revision history
- `interface.md` — the controls and feedback people need to see

These files are one brief split by topic. None of them is optional.

Seed data is under `/assets/workbook_seed.json`. Nothing in the finished app
should depend on somebody knowing a hidden route, request shape or element id.
