# PatchPad Application Manifest

## Start Command
```
npm start
```

The application runs on `0.0.0.0:${PORT:-3000}` (default port 3000).

## SQLite Database Location
```
SQLite path: /app/patchpad.db
```

## Main Application Routes

### Document Management
- **GET /api/reports**
  - Returns list of available reports with id, title, and author
  - Response: `[{ id, title, author }, ...]`

- **GET /api/documents/:id**
  - Fetch a document with current content and revision
  - Response: `{ id, title, author, summary, currentRevision, content }`

### Revision History
- **GET /api/documents/:id/history**
  - Get list of all revisions for a document
  - Response: `[{ revisionNumber, timestamp }, ...]`

- **GET /api/documents/:id/revisions/:revision**
  - Fetch specific revision content
  - Response: `{ revisionNumber, content, timestamp }`

### Save and Conflict Detection
- **POST /api/documents/:id/save**
  - Save document changes with conflict detection
  - Request Body: `{ documentId?, content, baseRevision }`
  - Response on success (200): `{ success: true, revision }`
  - Response on conflict (409): `{ error: "Stale save attempt", currentRevision, currentContent }`
  - Response on validation error (400): `{ error: "..." }`

### Main Interface
- **GET /**
  - Serve the main editor interface (index.html)

## Database Schema

### documents Table
- `id` (TEXT, PRIMARY KEY): Unique document identifier
- `title` (TEXT): Document title
- `author` (TEXT): Document author
- `summary` (TEXT): Document summary
- `currentRevision` (INTEGER): Current revision number
- `content` (TEXT): Current document content
- `lastModified` (TEXT): ISO timestamp of last modification

### revisions Table
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Internal revision ID
- `documentId` (TEXT, FOREIGN KEY): Reference to document
- `revisionNumber` (INTEGER): Revision number for the document
- `content` (TEXT): Content of this revision
- `timestamp` (TEXT): ISO timestamp when revision was created

## Conflict Safety Implementation

The application implements optimistic locking based on revision numbers:

1. When opening a document, the browser records the `baseRevision`
2. On save, the request includes the `baseRevision`
3. Server validates that `baseRevision === currentRevision` in the database
4. If they don't match, the server returns HTTP 409 (Conflict) with the current server content
5. The client preserves the user's draft and displays a conflict message
6. User can choose to keep their draft or reload the server version

This ensures that concurrent edits in multiple tabs cannot silently lose data.

## Key Features

- **Custom DOM-based text editor** with line numbers and cursor visualization
- **Full text editing support**: typing, selection, undo/redo, cut/copy/paste
- **Find and Replace** with navigation between matches
- **Multiple carets** using Alt+Click or Ctrl/Cmd+Click
- **Revision history** with preview and restore functionality
- **Conflict detection** for concurrent edits
- **Line number display** with proper synchronization
- **Emoji and accented character support** for proper text handling
- **Keyboard shortcuts** (Ctrl+S for save, Ctrl+Z for undo, etc.)

## Initial Data

On first run, the application seeds the database with the incident report from `/assets/incident_seed.json`:
- Document ID: `incident-alpha`
- Title: "Northwind API Incident Report"
- Author: "Riley Stone"
- Revision 1 is created at initialization
- Subsequent saves increment the revision number

The seed data is only created once. Restarting the application preserves saved content and revision history.
