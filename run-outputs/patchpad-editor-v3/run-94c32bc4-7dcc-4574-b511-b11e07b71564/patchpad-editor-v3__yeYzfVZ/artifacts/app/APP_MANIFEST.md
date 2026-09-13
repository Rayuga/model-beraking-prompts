# PatchPad App Manifest

Start command: `npm start`
SQLite path: `/app/patchpad.db`

## Main Application Routes and Methods

### Document & Reports
- `GET /`: Serves the PatchPad editor browser client.
- `GET /api/reports`: Lists available reports with metadata (`id`, `title`, `author`, `summary`, `current_revision`, `updated_at`).
- `GET /api/reports/:id`: Loads a specific report with its latest saved content, revision number, and metadata.

### Saving & Conflict Safety
- `POST /api/reports/:id/save`: Saves report changes.
  - Accepts JSON payload: `{ baseRevision: integer, content: string, documentId?: string, comment?: string }`.
  - Performs conflict detection: returns HTTP `409 Conflict` if `baseRevision` does not match the server's current revision.
  - Unchanged saves do not increment the revision.
  - Changed saves increment the revision by 1 and store a new snapshot in SQLite.
- `PUT /api/reports/:id`: Alias for saving report changes.

### Revision History & Previews
- `GET /api/reports/:id/revisions`: Lists all revisions for a report with revision numbers, timestamps, character counts, and comments.
- `GET /api/reports/:id/revisions/:revNum`: Retrieves the full content and metadata of a specific revision for previewing or restoring.
