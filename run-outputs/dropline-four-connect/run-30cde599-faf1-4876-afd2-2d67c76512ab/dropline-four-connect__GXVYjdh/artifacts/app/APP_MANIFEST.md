# DropLine API Manifest

## Start Command
```bash
node /app/server.js
```

SQLite path: /app/dropline.db

Environment variable `DB_PATH` can override the default database location.

## Authentication Endpoints

### Sign In
- **POST** `/api/signin`
  - Request: `{ email: string, password: string }`
  - Response: `{ token: string, account: { id: number, email: string, name: string } }`
  - Authentication: None required
  - Returns bearer token for use in subsequent requests

### Sign Out
- **POST** `/api/signout`
  - Request: Empty body
  - Response: `{ ok: true }`
  - Authentication: Bearer token required
  - Revokes all tokens for the signed-in account

## Game State Endpoints

### Get Game State
- **GET** `/api/game`
  - Request: None
  - Response: `{ game: GameState | null }`
  - Authentication: Bearer token required
  - Returns current game state or null if no game exists

### Make Move
- **POST** `/api/move`
  - Request: `{ column: number, operationId: string, expectedRevision: number }`
  - Response: `{ game: GameState }` or error
  - Authentication: Bearer token required
  - Status codes:
    - 200: Move accepted
    - 400: Invalid move or parameters
    - 409: Revision conflict (game updated in another tab)

### Undo
- **POST** `/api/undo`
  - Request: `{ operationId: string, expectedRevision: number }`
  - Response: `{ game: GameState }` or error
  - Authentication: Bearer token required
  - Removes last move and returns turn to that piece's color

### Redo
- **POST** `/api/redo`
  - Request: `{ operationId: string, expectedRevision: number }`
  - Response: `{ game: GameState }` or error
  - Authentication: Bearer token required
  - Restores last undone move exactly

### New Game
- **POST** `/api/newgame`
  - Request: `{ operationId: string, expectedRevision: number }`
  - Response: `{ game: GameState }` or error
  - Authentication: Bearer token required
  - Clears board and move history, preserves scores

## Game State Schema
```javascript
{
  id: number,
  roundId: string,
  board: string[] (42 items, '' | 'Red' | 'Yellow'),
  currentPlayer: 'Red' | 'Yellow',
  status: 'active' | 'terminal',
  winningCells: number[] (up to 4 cell indices),
  redWins: number,
  yellowWins: number,
  draws: number,
  revision: number (increments on each move/undo/redo/newgame),
  moves: Move[] (applied moves in order),
  redoMoves: Move[] (undone moves in reverse order)
}

Move: {
  number: number,
  color: 'Red' | 'Yellow',
  column: number (1-7),
  row: number (1-6)
}
```

## Archive Endpoints

### Get Archives
- **GET** `/api/archives`
  - Request: None
  - Response: `{ total: number, archives: ArchiveInfo[] }`
  - Authentication: Bearer token required
  - Returns latest 10 completed matches, most recent first

### Get Archive Details
- **GET** `/api/archive/:id`
  - Request: None
  - Response: `{ archive: ArchiveDetail }`
  - Authentication: Bearer token required
  - Returns full archive with board state

### Archive Schema
```javascript
ArchiveInfo: {
  id: number,
  matchId: string,
  result: 'Red wins' | 'Yellow wins' | 'Draw',
  moveCount: number,
  completedAt: string (ISO datetime)
}

ArchiveDetail: {
  id: number,
  matchId: string,
  result: string,
  board: string[] (42 items, final board state),
  moveCount: number
}
```

## Analysis Endpoints

### Create Analysis
- **POST** `/api/analyses`
  - Request: `{ matchId: string, sourceStep: number, name: string }`
  - Response: `{ analysis: AnalysisState }`
  - Authentication: Bearer token required
  - Creates a named analysis from a completed match at a specific step

### List Analyses
- **GET** `/api/analyses`
  - Request: None
  - Response: `{ analyses: AnalysisSummary[] }`
  - Authentication: Bearer token required
  - Returns all analyses for the authenticated account

### Get Analysis
- **GET** `/api/analyses/:id`
  - Request: None
  - Response: `{ analysis: AnalysisState }`
  - Authentication: Bearer token required
  - Returns full analysis with all nodes

### Analysis Move
- **POST** `/api/analyses/:id/move`
  - Request: `{ column: number, operationId: string, expectedRevision: number }`
  - Response: `{ analysis: AnalysisState }` or error
  - Authentication: Bearer token required
  - Makes a move in analysis workspace

### Analysis Undo
- **POST** `/api/analyses/:id/undo`
  - Request: `{ operationId: string, expectedRevision: number }`
  - Response: `{ analysis: AnalysisState }` or error
  - Authentication: Bearer token required
  - Selects parent node (cannot undo past root)

### Analysis Redo
- **POST** `/api/analyses/:id/redo`
  - Request: `{ childId: number, operationId: string, expectedRevision: number }`
  - Response: `{ analysis: AnalysisState }` or error
  - Authentication: Bearer token required
  - Selects child node (requires childId if multiple children)

### Select Analysis Node
- **POST** `/api/analyses/:id/select`
  - Request: `{ nodeId: number, operationId: string, expectedRevision: number }`
  - Response: `{ analysis: AnalysisState }` or error
  - Authentication: Bearer token required
  - Selects a specific node in the tree

### Rename Analysis
- **POST** `/api/analyses/:id/rename`
  - Request: `{ name: string, operationId: string, expectedRevision: number }`
  - Response: `{ analysis: AnalysisState }` or error
  - Authentication: Bearer token required
  - Renames analysis (trims whitespace, 1-60 chars)

### Compare Positions
- **POST** `/api/analyses/:id/compare`
  - Request: `{ leftNodeId: number, rightNodeId: number }`
  - Response: `{ comparison: Comparison }`
  - Authentication: Bearer token required
  - Compares two positions in the same analysis

### Transplant Preview
- **POST** `/api/analyses/:id/transplant-preview`
  - Request: `{ sourceAnalysisId: number, sourceNodeId: number, destNodeId: number, operationId: string }`
  - Response: `{ preview: TransplantPreview }` or error
  - Authentication: Bearer token required
  - Preview copying a branch without committing

### Transplant Commit
- **POST** `/api/analyses/:id/transplant-commit`
  - Request: `{ operationId: string, expectedRevision: number }`
  - Response: `{ analysis: AnalysisState, mapping: NodeMapping }` or error
  - Authentication: Bearer token required
  - Commits previously previewed transplant

### Tactical Report
- **GET** `/api/analyses/:id/tactical?nodeId=number&depth=number`
  - Request: Query parameters: nodeId (number), depth (1-4)
  - Response: `{ report: TacticalReport }`
  - Authentication: Bearer token required
  - Bounded tactical analysis from a position

## Health Check

### Health
- **GET** `/api/health`
  - Request: None
  - Response: `{ status: 'ok' }`
  - Authentication: None required
  - Simple health check for server readiness

## Error Responses

All 4xx error responses follow this schema:
```javascript
{
  error: string (human-readable error message)
}
```

Conflict responses (409) include the current game state:
```javascript
{
  error: string,
  game: GameState (current authoritative state)
}
```

## Database Persistence

- All game moves, undo/redo history, and game state are persisted immediately
- All operations are atomic - no partial writes
- Analysis nodes and their trees are persisted in SQLite
- Operation receipts enable idempotency: identical operation IDs with same parameters return original response without reapplying
- Database survives normal server restart without data loss or reseeding

## Bearer Token Authentication

- Tokens are unpredictable 32-byte random hex strings
- Tokens are stored in SQLite with creation timestamp
- Token revocation updates revoked_at timestamp (soft delete)
- All protected endpoints require Authorization header: `Bearer <token>`
- Invalid or revoked tokens return 401 Unauthorized
- Signing out revokes all tokens for that account globally
