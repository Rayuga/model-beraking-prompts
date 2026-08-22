# GridForge Application Manifest

## Start

```bash start
cd /app
npm start
```

The Node.js app listens on `0.0.0.0:${PORT:-3000}`.

## System of record

SQLite database: `/app/gridforge.sqlite`

Set `GRIDFORGE_DB` only for isolated testing. On first startup, users and the **Northwind Operations Plan** workbook are seeded idempotently from `/assets/workbook_seed.json`.

## Main API routes

- `GET /api/bootstrap` — seeded users and current workbook
- `GET /api/workbooks/:id` — current saved workbook
- `POST /api/workbooks/:id/save` — validated revision-aware save and conflict merge
- `GET /api/workbooks/:id/revisions` — revision history
- `GET /api/workbooks/:id/revisions/:revision` — revision snapshot
- `GET /api/workbooks/:id/cells/:sheet/:address/history` — cell edit history
- `GET /api/events` — live save and presence event stream
- `POST /api/presence` and `DELETE /api/presence/:sessionId` — view presence
