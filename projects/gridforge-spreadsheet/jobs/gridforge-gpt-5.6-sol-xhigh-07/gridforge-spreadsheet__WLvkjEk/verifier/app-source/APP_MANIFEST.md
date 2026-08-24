# GridForge application manifest

## Start

```bash start
cd /app
npm install
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

## Database

SQLite system-of-record: `/app/gridforge.sqlite` (override with `GRIDFORGE_DB`). The database and idempotent seed revision are created on first startup from `/assets/workbook_seed.json`.

## Main API routes

- `GET /api/users` — seeded login users
- `GET /api/workbooks` — workbook list
- `GET /api/workbooks/:id` — current workbook and revision
- `POST /api/workbooks/:id/save` — validated conflict-safe cell save
- `GET /api/workbooks/:id/revisions` — revision history
- `GET /api/workbooks/:id/revisions/:number` — revision snapshot preview
- `GET /api/workbooks/:id/history?sheetId=...&address=...` — cell edit history
- `WS /live` — live presence, selections, and saved-change notifications
