# PatchPad Application Manifest

Start command: `npm start`

SQLite path: /app/patchpad.db

Main routes and methods:

- `GET /` — open the PatchPad editor shell and initial report list.
- `GET /api/reports` — list stored reports with id, title, and author.
- `GET /api/reports/:reportId` — load the open report, including its current content and revision list.
- `GET /api/reports/:reportId/revisions` — browse revision history metadata.
- `GET /api/reports/:reportId/revisions/:revisionNumber` — preview one saved revision's content.
- `POST /api/reports/:reportId/save` — save the current draft with conflict-safe revision checking.

Notes:
- The seed report is created from `/assets/incident_seed.json` only when the database is empty.
- Existing saved data and revision history remain in SQLite across normal restarts.
