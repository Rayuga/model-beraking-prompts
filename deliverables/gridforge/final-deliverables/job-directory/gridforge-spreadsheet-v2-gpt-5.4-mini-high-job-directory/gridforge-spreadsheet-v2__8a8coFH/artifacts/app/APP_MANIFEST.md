# GridForge manifest

## Start

```bash start
npm start
```

## SQLite database

- `/app/gridforge.sqlite3`

## Main API routes

- `GET /api/bootstrap`
- `GET /api/workbooks/ops-plan/state?sessionId=...`
- `POST /api/workbooks/ops-plan/save`
- `GET /api/workbooks/ops-plan/revisions`
- `GET /api/workbooks/ops-plan/revisions/:revisionId`
- `GET /api/workbooks/ops-plan/cells/:address/history?sheetId=plan`
- `POST /api/sessions`
- `POST /api/sessions/:sessionId/presence`
- `POST /api/sessions/:sessionId/heartbeat`
- `POST /api/sessions/:sessionId/close`
- `GET /api/stream?sessionId=...`
