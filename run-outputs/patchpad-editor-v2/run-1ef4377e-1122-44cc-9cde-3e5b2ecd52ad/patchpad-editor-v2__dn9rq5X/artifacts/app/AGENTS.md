# Repository Memory

- PatchPad runs with `npm start` from `/app` and listens on `0.0.0.0:${PORT:-3000}`.
- SQLite source of truth: `/app/patchpad.db`.
- The seed report is `incident-alpha` from `/assets/incident_seed.json` and must only be inserted once.
- Node 22's built-in `node:sqlite` module is used; no external SQLite package is required.
- Key API routes: `GET /api/reports`, `GET /api/reports/:id`, `GET /api/reports/:id/revisions`, `GET /api/reports/:id/revisions/:revision`, `POST /api/reports/:id/save`.
