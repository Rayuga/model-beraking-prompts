# PatchPad App Manifest

- Start command: `npm start`
- SQLite path: `/app/patchpad.sqlite`

## Routes and methods

- `GET /` — open the PatchPad editor shell and report list
- `GET /api/reports` — browse available reports
- `GET /api/reports/:documentId` — open a report with its current saved content and revision list
- `GET /api/reports/:documentId/revisions` — browse revision history for one report
- `GET /api/reports/:documentId/revisions/:revisionNumber` — preview a saved revision
- `POST /api/reports/:documentId/save` — save the open report with `baseRevision` and text content
