# AGENTS.md

## PatchPad notes
- Start command: `npm start`
- App entry: `/app/server.js`
- Client app: `/app/public/app.js`
- SQLite database: `/app/data/patchpad.sqlite`
- Seed source: `/assets/incident_seed.json`
- Seed the database only when `documents` is empty; do not duplicate the seed on restart.
- Save API uses `baseRevision` optimistic locking and must reject stale saves with HTTP 409.
- The editor surface is custom DOM rendering, not textarea/contenteditable.
- History entries and preview content come from `/api/documents/:id/revisions` and `/api/documents/:id/revisions/:revision`.
