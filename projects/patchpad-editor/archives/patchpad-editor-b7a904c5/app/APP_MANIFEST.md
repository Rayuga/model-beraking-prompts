# PatchPad Application Manifest

## Start

```bash start
npm start
```

The app listens on `0.0.0.0:${PORT:-3000}`.

## Database

SQLite database path: `/app/data/patchpad.sqlite`

Set `DATABASE_PATH` to use a different SQLite file. On the first startup with an empty database, PatchPad reads `/assets/incident_seed.json` and transactionally creates the seeded document and revision 1.

## Main API routes

- `GET /api/documents` — list documents
- `GET /api/documents/:id` — get the current saved document and revision
- `PUT /api/documents/:id` — save content using `id`, `title`, `content`, and `baseRevision`
- `GET /api/documents/:id/revisions` — list saved revisions
- `GET /api/documents/:id/revisions/:revisionNumber` — retrieve a revision for preview or restore
