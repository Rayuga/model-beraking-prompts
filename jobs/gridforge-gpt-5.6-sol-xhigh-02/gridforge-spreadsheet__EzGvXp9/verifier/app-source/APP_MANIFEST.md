# GridForge Application Manifest

## Start

```bash start
cd /app && npm start
```

The app listens on `0.0.0.0:${PORT:-3000}`.

## Database

SQLite system-of-record: `/app/gridforge.sqlite`

The database and seed revision are created automatically and idempotently on first startup from `/assets/workbook_seed.json`.

## Main API routes

- `GET /api/bootstrap` — users, current workbook, current revision, revision list
- `POST /api/workbooks/:id/save` — validated, revision-aware workbook save
- `GET /api/workbooks/:id/revisions/:revision` — immutable revision snapshot
- `GET /api/workbooks/:id/history?sheetId=...&address=...` — cell edit history
- `GET /api/events?sessionId=...` — Server-Sent Events for presence and saved revisions
- `POST /api/presence` — update the active session's user and selection
