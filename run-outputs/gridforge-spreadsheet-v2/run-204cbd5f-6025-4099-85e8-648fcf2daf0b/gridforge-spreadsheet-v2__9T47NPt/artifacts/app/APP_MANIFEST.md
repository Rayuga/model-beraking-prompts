# GridForge Manifest

## Start Command

```bash start
npm start
```

## Database Location

- **SQLite Database Path**: `/app/gridforge.db`

## API Routes

### Workbook Operations
- `GET /api/workbook`: Fetches the current default workbook snapshot ("ops-plan"), current revision, and active sheet details.
- `GET /api/workbooks/:id`: Fetches the workbook snapshot for the specified workbook ID along with current revision metadata and sheets.
- `POST /api/workbooks/:id/save`: Saves a complete workbook snapshot with base revision verification, concurrency check, and user attribution.
- `PUT /api/workbooks/:id`: Equivalent to `POST /api/workbooks/:id/save`.

### Revision & History Operations
- `GET /api/workbooks/:id/revisions`: Returns the complete timestamped revision history with revision numbers, author attributions, and change descriptions.
- `GET /api/workbooks/:id/revisions/:rev`: Returns the snapshot and metadata for a specific integer revision number.
- `GET /api/workbooks/:id/sheets/:sheetId/cells/:cellRef/history`: Returns the chronological audit history for a specific cell, including old value, new value, author, and timestamp.

### Collaboration & Users
- `GET /api/users`: Returns the list of available seeded users (`riley`, `morgan`, `priya`).
- `WS /ws`: WebSocket endpoint for real-time presence broadcasting, cursor positions, selection ranges, user switching, and instant revision notifications.
