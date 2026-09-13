# DropLine - Connect Four Game

## Start Command
```bash
node /app/server.js
```

## SQLite Database Path
```
/app/dropline.db
```

## API Routes

### Authentication
- **POST /api/sign-in** - Sign in with email and password
  - Request: `{ email: string, password: string }`
  - Response: `{ token: string, email: string, name: string }`

- **POST /api/sign-out** - Sign out the current user (requires Bearer token)
  - Response: `{ success: boolean }`

### Game State
- **GET /api/game** - Get current game state (requires Bearer token)
  - Response: Game state object with board, status, scores, move history, etc.

### Game Mutations
- **POST /api/move** - Drop a piece in a column (requires Bearer token)
  - Request: `{ column: number, revision: number, operationId: string }`
  - Response: Updated game state or error

- **POST /api/undo** - Undo the last move (requires Bearer token)
  - Request: `{ revision: number, operationId: string }`
  - Response: Updated game state or error

- **POST /api/redo** - Redo an undone move (requires Bearer token)
  - Request: `{ revision: number, operationId: string }`
  - Response: Updated game state or error

- **POST /api/new-game** - Start a new game (requires Bearer token)
  - Request: `{ revision: number, operationId: string }`
  - Response: Updated game state with empty board and new round ID

### Archive
- **GET /api/archive** - Get list of completed matches (requires Bearer token)
  - Response: `{ totalCount: number, records: array }`

- **GET /api/archive/:matchId** - Get a specific completed match for replay (requires Bearer token)
  - Response: Match data with final board state

### Health
- **GET /api/health** - Health check endpoint
  - Response: `{ status: "ready" }`

## Database Tables

- **accounts** - User accounts with email, name, and password hash
- **sessions** - Active authentication sessions with bearer tokens
- **games** - Current game state for each account
- **moves** - Applied moves in the current round
- **redo_stack** - Undone moves available for redo
- **archives** - Completed matches
- **operation_idempotency** - Stores results of mutations for idempotency

## Features
- Real authentication with bearer tokens
- Server-side move validation and game logic
- Persistent game state with undo/redo
- Multi-tab concurrency with idempotency keys
- Completed match archive with read-only replay
- Account-scoped data isolation
- Seed data import from Excel workbook on first run

## Environment Variables
- `DB_PATH` - Override default SQLite database path (default: `/app/dropline.db`)
- `PORT` - Override server port (default: `3000`)
