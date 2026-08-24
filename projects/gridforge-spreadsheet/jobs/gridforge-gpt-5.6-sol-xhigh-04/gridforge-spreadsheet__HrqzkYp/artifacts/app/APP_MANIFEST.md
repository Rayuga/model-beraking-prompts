# GridForge application manifest

## Start

```bash start
cd /app && npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

## Database

SQLite system-of-record: `/app/gridforge.sqlite`

The database, schema, seeded users, workbook, and initial revision are created idempotently on first startup from `/assets/workbook_seed.json`.

## Main API routes

- `GET /api/bootstrap` — users, current workbook snapshot, and revisions
- `POST /api/workbooks/:id/save` — validated cell-patch save with base-revision conflict detection
- `GET /api/workbooks/:id/revisions/:number` — prior revision snapshot
- `GET /api/workbooks/:id/history?sheet=:sheetId&address=:cell` — selected-cell edit history
- `GET /api/workbooks/:id/events` — live revision and presence event stream
- `POST /api/workbooks/:id/presence` — publish/refresh an independent view session
- `DELETE /api/workbooks/:id/presence/:sessionId` — retire a view session
