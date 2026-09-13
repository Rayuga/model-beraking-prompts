# PatchPad Manifest

Start command: `npm start`

SQLite path: `/app/patchpad.db`

Main routes and methods:
- `GET /` renders the PatchPad shell and available reports.
- `GET /api/reports` lists stored reports with id, title, and author.
- `GET /api/reports/:id` opens a report and returns its latest saved content.
- `GET /api/reports/:id/revisions` lists the revision history for a report.
- `GET /api/reports/:id/revisions/:revision` fetches one saved revision for preview or restore.
- `POST /api/reports/:id/save` saves the current draft when `baseRevision` matches the server revision.
