# PatchPad Application Manifest

## Start Command
`npm start`

## SQLite Database
SQLite path: `/app/patchpad.db`

## Main Application Routes & Methods

| Route | HTTP Method | Description |
|---|---|---|
| `/` | `GET` | Main browser editor interface for opening and editing incident reports |
| `/api/reports` | `GET` | Lists all available stored incident reports with `id`, `title`, `author`, `summary`, and `current_revision` |
| `/api/reports/:id` | `GET` | Fetches a report's metadata, current revision number, and complete text content |
| `/api/reports/:id/save` | `POST` | Saves changed report content with optimistic concurrency / conflict safety. Expects `{ baseRevision, content, documentId? }`. Returns HTTP 200 on success, HTTP 409 on stale base revision, and HTTP 400 on invalid payload. |
| `/api/reports/:id/revisions` | `GET` | Fetches the revision history for a document, including revision numbers and timestamps |
| `/api/reports/:id/revisions/:rev` | `GET` | Fetches a specific revision's content and metadata for preview or restoration |
