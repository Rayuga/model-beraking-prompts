# GridForge - Shared Collaborative Spreadsheet

GridForge is a browser-based collaborative spreadsheet application designed for operations teams to work together on shared workbooks in real-time.

## Starting the Application

```bash
npm start
```

This starts the server on port 3000 (or the PORT environment variable if set). Open http://localhost:3000 in your browser.

## Database

The application uses SQLite for persistent storage.

**Database file location:** `/app/gridforge.sqlite3`

The database is automatically initialized on first run and seeded with the Northwind Operations Plan workbook from `/assets/workbook_seed.json`.

## API Routes

### Workbook Management

- **GET /api/workbooks/:workbookId** - Get current workbook snapshot with calculated cell values
- **GET /api/workbooks/:workbookId/revisions** - Get list of revision history
- **GET /api/workbooks/:workbookId/revisions/:revision** - Get specific revision snapshot
- **PUT /api/workbooks/:workbookId** - Save workbook changes (handles conflict resolution)

### Cell History

- **GET /api/workbooks/:workbookId/sheets/:sheetId/cells/:address/history** - Get cell change history with user and timestamp

### Sessions & Collaboration

- **POST /api/sessions** - Create a new editing session (returns sessionId)
- **DELETE /api/sessions/:sessionId** - End an editing session
- **GET /api/presence/:workbookId** - Get list of active users and their current selections
- **PUT /api/presence/:sessionId** - Update current selection for a session

### Calculations

- **POST /api/calculate** - Calculate a formula with given cell values

## Features

### Grid & Editing
- 80+ rows and 20 columns (A to T)
- Click to select cells, drag to select ranges
- Double-click to edit or press F2
- Keyboard navigation with arrow keys
- Cut (Ctrl+X), Copy (Ctrl+C), Paste (Ctrl+V)
- Paste from Excel/Sheets as Tab-Separated Values
- Undo/Redo (Ctrl+Z, Ctrl+Y)
- Fill Down (Ctrl+D) and Fill Right (Ctrl+R)
- Delete cell contents

### Formulas
- Support for formulas starting with `=`
- Arithmetic operations: +, -, *, /
- Parentheses for grouping
- Cell references: A1, B2, etc.
- Range references: A1:D5
- Functions: SUM, AVG, MIN, MAX, COUNT
- Live formula recalculation
- Error detection: division by zero, circular references, invalid syntax

### Collaboration
- Select a user before starting work (Riley, Morgan, or Priya)
- See who else is online and what they're editing
- Cell change history with user attribution and timestamps
- Concurrent edit handling with conflict detection
- Changes automatically sync across all open views

### Saving & History
- Automatic saving within 5 seconds of changes (autosave)
- Manual save with Save button (Ctrl+S)
- Revision history browser showing all previous versions
- Preview revisions before restoring
- Restore earlier versions into editable drafts

### Find & Replace
- Find text in cells (Ctrl+H)
- Replace individual matches or all matches
- Options: Match case, Entire cell only
- Navigate through results

### Name Box
- Jump to specific cell: Type cell address like "A1" and press Enter
- Select range: Type range like "A1:D5" and press Enter

## Architecture

### Backend
- **Express.js** - HTTP server and API
- **SQLite3** - Data persistence
- Custom formula calculation engine
- Conflict resolution for concurrent edits
- Session management for multi-user editing

### Frontend
- Vanilla JavaScript (no framework dependencies)
- Custom grid component with DOM rendering
- WebSocket-ready presence updates
- Client-side undo/redo
- Real-time presence indicators

## Development Dependencies

All runtime dependencies are included in `/app/node_modules/`:
- express@5.2.1 - Web framework
- sqlite3@5.1.6 - Database driver
- uuid@9.0.0 - Session ID generation

## Data Format

Workbooks are stored as JSON snapshots in the database:

```json
{
  "workbook": {
    "id": "ops-plan",
    "title": "Northwind Operations Plan",
    "sheets": [
      { "id": "plan", "name": "Plan" }
    ]
  },
  "sheets": [
    {
      "id": "plan",
      "name": "Plan",
      "cells": {
        "A1": "Item",
        "B1": "Qty",
        "D2": "=B2*C2"
      }
    }
  ]
}
```

All cell values are stored as strings (including numbers and formulas). Formulas begin with `=`.

## Troubleshooting

**Port already in use:**
```bash
PORT=3001 npm start
```

**Database file issues:**
Delete `/app/gridforge.sqlite3` to reset (the app will re-seed the workbook on next start).

**Installation issues:**
```bash
npm install
npm start
```
