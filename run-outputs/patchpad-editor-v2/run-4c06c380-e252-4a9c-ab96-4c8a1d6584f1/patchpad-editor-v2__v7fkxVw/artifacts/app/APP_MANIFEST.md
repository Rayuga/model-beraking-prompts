# PatchPad Manifest

Start command: `npm start`
SQLite path: `/app/patchpad.db`

## Main API Routes

- `GET /api/documents` (or `GET /api/reports`): List all available incident reports.
- `GET /api/documents/:id` (or `GET /api/reports/:id`): Get document metadata and current content.
- `GET /api/documents/:id/revisions`: Get revision history for a document.
- `GET /api/documents/:id/revisions/:rev`: Get specific revision content and metadata.
- `POST /api/documents/:id/save` (or `PUT /api/documents/:id`): Save document changes with conflict safety (`baseRevision`, `content`).
- `GET /api/health`: Health check endpoint.
