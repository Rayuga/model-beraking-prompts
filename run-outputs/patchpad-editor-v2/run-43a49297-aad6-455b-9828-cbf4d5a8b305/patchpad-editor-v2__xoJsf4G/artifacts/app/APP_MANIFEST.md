# PatchPad Application Manifest

## Start Command
```
npm start
```

## SQLite Database
SQLite path: `/app/patchpad.db`

## Main Application Routes

### Document Management

**GET `/`**
- Serves the main editor interface (index.html)
- Displays the editor for the specified or default report

**GET `/api/reports`**
- Returns a JSON array of all available reports
- Each report includes: `id`, `title`, `author`
- Used for report listing/discovery

**GET `/api/reports/:id`**
- Retrieves a specific report with full content and revision history
- Response includes: `id`, `title`, `author`, `content`, `currentRevision`, `revisions`
- `revisions` array contains: `revision` number and `timestamp` for each saved version

### Revision History

**GET `/api/reports/:id/revisions`**
- Returns revision history for a specific report
- Response is an array of objects with `revision` and `timestamp`

**GET `/api/reports/:id/revisions/:rev`**
- Retrieves the full content of a specific revision
- Response includes `content` and `timestamp`
- Used for previewing historical versions

### Saving and Conflict Resolution

**POST `/api/reports/:id/save`**
- Saves changes to a report with conflict detection
- Request body must include:
  - `content` (string): The new document content
  - `baseRevision` (integer): The revision being saved from
  - `documentId` (optional string): The document ID being saved
- Response on success (200):
  - `documentId`: The saved document ID
  - `revision`: The new revision number created
  - `status`: Either "saved" (new revision) or "unchanged" (no changes to save)
- Response on conflict (409):
  - `error`: "Conflict: Document was modified by another tab"
  - `currentRevision`: The current server revision number
- Response on validation error (400):
  - `error`: Description of invalid input (missing content, non-text content, non-integer revision, document ID mismatch)

## Key Features

### Editing
- Custom DOM-based text editor without contenteditable
- Supports typing, newlines, backspace, delete, arrow keys, Home/End
- Line numbers with current cursor position display
- Word movement (Ctrl/Cmd+Arrow), Tab indentation
- Full selection support (keyboard and mouse)
- Copy, cut, paste operations
- Multi-line clipboard text handling
- Undo/Redo with smart grouping (consecutive edits grouped within 500ms)
- Find and Replace with match counting
- Keyboard shortcuts for common operations

### Persistence
- SQLite database stores all documents and revisions
- Each save creates a new revision (unless content unchanged)
- Seed document loaded once on first startup from `/assets/incident_seed.json`
- Revision history preserved across application restarts

### Conflict Safety
- Saves validated against `baseRevision` (the revision when editing started)
- Stale saves rejected with HTTP 409 if another tab saved changes
- User draft preserved when conflict occurs
- Can reload or discard conflicting changes via dialog
- Server prevents silent overwrites of concurrent changes

## Database Schema

### Documents Table
```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  currentRevision INTEGER NOT NULL
);
```

### Revisions Table
```sql
CREATE TABLE revisions (
  documentId TEXT NOT NULL,
  revision INTEGER NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  PRIMARY KEY (documentId, revision),
  FOREIGN KEY (documentId) REFERENCES documents(id)
);
```

## Dependencies
- express@5.1.0 - Web server framework
- better-sqlite3 - SQLite database driver

## Public Assets
- `/public/index.html` - Main application interface
- `/public/styles.css` - Application styling
- `/public/editor.js` - Editor logic and interaction handling

## Server Configuration
- Listens on `0.0.0.0:${PORT:-3000}` (default port 3000)
- Serves static assets from `/app/public/`
- JSON request/response format with 50MB size limit
- All data stored locally in SQLite (no remote services)
