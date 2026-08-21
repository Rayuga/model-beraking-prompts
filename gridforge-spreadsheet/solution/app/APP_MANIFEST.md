# GridForge Spreadsheet

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

## Persistence

- Engine: SQLite via Node built-in `node:sqlite`
- Path: `/app/data/gridforge.db`
- Seed source: `/assets/workbook_seed.json`
- Schema and seed run idempotently on startup.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/api/users` | List seeded users for edit attribution |
| GET | `/api/workbooks` | List workbooks |
| GET | `/api/workbooks/:id` | Load current workbook, revision, and latest cell attribution |
| POST | `/api/workbooks/:id/save` | Save workbook with `baseRevision`, user attribution, and cell-level conflict/merge checks |
| GET | `/api/workbooks/:id/revisions` | List recent saved revisions |
| GET | `/api/workbooks/:id/revisions/:revision` | Read a prior revision |
| GET | `/api/workbooks/:id/cells/:addr/history` | Read selected-cell edit history |

## Spreadsheet

The grid surface is a focusable custom DOM view with `role="grid"`. It is not a
textarea, a cell-per-input table, contenteditable, or third-party spreadsheet
widget.

## Seeded users

- Riley Stone
- Morgan Lee
- Priya Shah

The user selector is intentionally lightweight. Saves include the selected
user, and the server records per-cell edit history plus last-editor metadata.
