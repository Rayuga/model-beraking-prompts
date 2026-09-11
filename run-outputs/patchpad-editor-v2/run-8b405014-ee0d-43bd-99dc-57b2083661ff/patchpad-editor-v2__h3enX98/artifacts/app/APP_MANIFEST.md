# PatchPad Application Manifest

## Start Command
```bash
npm start
```

The application will start on `http://0.0.0.0:3000` (or the port specified by the `PORT` environment variable).

## Database
SQLite path: `/app/patchpad.db`

The database is automatically initialized on first run with the seed document from `/assets/incident_seed.json`. Subsequent runs preserve existing data and revision history.

## Main API Routes

### Documents
- `GET /api/documents` - List all available reports (id, title, author)
- `GET /api/documents/:id` - Fetch a specific report with current content and revision
- `POST /api/documents/:id/save` - Save document changes with conflict detection
  - Request body: `{ content: string, baseRevision: integer, documentId?: string }`
  - Response: `{ revision: integer, status: "saved" | "unchanged" }`
  - Returns HTTP 409 if baseRevision is stale (another tab saved changes)

### Revision History
- `GET /api/documents/:id/history` - Get revision history (number, timestamp for each revision)
- `GET /api/documents/:id/revisions/:revisionNumber` - Fetch specific revision content
- `POST /api/documents/:id/restore/:revisionNumber` - Restore a previous revision (creates new revision)

### UI
- `GET /` - Main editor interface

## Features
- Full-featured text editor with line numbers, cursor position display
- Undo/Redo with intelligent grouping of continuous edits
- Find and Replace with match count and navigation
- Multiple carets/cursors with Alt+Click or Ctrl+Click
- Keyboard shortcuts: Ctrl+S (Save), Ctrl+Z (Undo), Ctrl+Shift+Z (Redo), Ctrl+F (Find), Ctrl+H (Replace)
- Tab indentation support
- Revision history with preview and restore functionality
- Conflict detection and safety: rejects stale saves with HTTP 409
- Persistent storage with automatic database seeding

## Database Schema

### documents table
- id (TEXT PRIMARY KEY): Document identifier
- title (TEXT): Document title
- author (TEXT): Document author
- summary (TEXT): Brief description
- currentRevision (INTEGER): Current active revision number
- createdAt (DATETIME): Creation timestamp
- updatedAt (DATETIME): Last update timestamp

### revisions table
- id (INTEGER PRIMARY KEY AUTOINCREMENT): Revision record ID
- documentId (TEXT FOREIGN KEY): Reference to documents.id
- revisionNumber (INTEGER): Revision number (unique per document)
- content (TEXT): Full document content
- createdAt (DATETIME): Revision creation timestamp

## Deployment Notes
- All dependencies are included in `node_modules/` for offline operation
- No external services or APIs are required
- The application uses synchronous database operations for reliability
- Supports browser reloading and multi-tab safe concurrent editing
