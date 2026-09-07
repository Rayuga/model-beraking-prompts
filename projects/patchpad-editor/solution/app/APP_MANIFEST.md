# PatchPad Editor

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

## Persistence

- Engine: SQLite via Node built-in `node:sqlite`
- Path: `/app/data/patchpad.db`
- Seed source: `/assets/incident_seed.json`
- Schema and seed run idempotently on startup.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/api/documents` | List documents |
| GET | `/api/documents/:id` | Load current document and revision |
| POST | `/api/documents/:id/save` | Save content with `baseRevision` conflict check |
| GET | `/api/documents/:id/revisions` | List recent saved revisions |
| GET | `/api/documents/:id/revisions/:revision` | Read a prior revision |

## Editor

The editor surface is a focusable custom DOM view with `role="textbox"` and
`aria-multiline="true"`. It is not a textarea, input, contenteditable element,
or third-party editor widget.
