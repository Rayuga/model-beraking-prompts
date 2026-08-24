# PatchPad Application Manifest

## Start

```bash start
npm start
```

PatchPad listens on `0.0.0.0:${PORT:-3000}`.

## Database

The SQLite database is stored at `./data/patchpad.sqlite` by default. Set `PATCHPAD_DB` to override the path.

## Main API routes

- `GET /api/documents` — list documents
- `GET /api/documents/:id` — load the current document and revision
- `PUT /api/documents/:id` — save content with `id` and `baseRevision`
- `GET /api/documents/:id/revisions` — list recent revisions
- `GET /api/documents/:id/revisions/:revision` — preview a revision
- `POST /api/documents/:id/restore` — restore a revision with conflict checking
