# DropLine - Connect Four Game

A polished, production-ready Connect Four game for two players sharing one browser, built with real authentication, persistent game state, and advanced features like undo/redo, move history, and match archives.

## Quick Start

```bash
cd /app
node server.js
```

The application will:
- Start on `0.0.0.0:3000`
- Serve the browser UI from `http://localhost:3000`
- Store durable game data in `/app/dropline.db`
- Automatically import seed accounts and initial game states on first run

## Features

### Authentication & Account Management
- **Real sign-in** with email and password (not a mock)
- **Bearer token authentication** with unpredictable tokens stored in SQLite
- **Token revocation** on sign-out (revokes all active tokens for the account)
- **Account isolation** - each account's data is completely separate
- **Seed accounts** pre-loaded: `avery@dropline.test` and `jordan@dropline.test` (both use `password123`)

### Gameplay
- **7×6 Connect Four board** - classic gameplay with gravity
- **Server-side validation** - all moves validated on the server
- **Win detection** - four in a row horizontally, vertically, or diagonally
- **Draw detection** - when all 42 cells are filled
- **Move feedback** - clear error messages (e.g., "Column 3 is full")
- **Turn indication** - shows "Red's turn" or "Yellow's turn"
- **Terminal state locking** - no more moves after a win or draw

### Move History & Undo/Redo
- **Chronological move history** - shows move number, color, column, and landing row
- **Server-backed undo** - removes the most recent move and returns the turn
- **Server-backed redo** - restores the exact undone move
- **Persistent history** - survives page reload and sign-out/sign-in
- **Score adjustment** - undoing a winning/drawing move reverses the score increment
- **Redo stack clearing** - new moves clear the redo stack

### Match Totals
- **Persistent scoring** - Red wins, Yellow wins, and Draws tracked per account
- **New game preservation** - match totals persist when starting a new game
- **Visible stats** - displayed prominently on the game screen

### Match Archive & Replay
- **Completed matches** - archived when a game ends in a win or draw
- **Read-only replay** - view final board states of completed matches
- **Archive list** - shows result, move count, and completion date
- **Latest 10 displayed** - with total count shown
- **Account-scoped** - each player sees only their own archives
- **Persistent archive** - survives New game, reload, sign-out, and later sign-in

### Multi-Tab Concurrency
- **Revision tracking** - every mutation increments the server revision
- **Stale request detection** - rejected if another tab modified the game first
- **Idempotency** - same operation ID returns the same result without changes
- **Debouncing** - repeated column activations while a move is pending produce only one move
- **Conflict resolution** - "Game updated in another tab" message with current state

### User Interface
- **Responsive design** - works at 375px width without horizontal scrolling
- **Accessible grid** - 42 grid cells with proper ARIA labels
- **Keyboard navigation** - arrow keys, Home, End, Enter, and Space
- **Focus preservation** - focus remains on column control after non-terminal moves
- **Reduced motion support** - respects `prefers-reduced-motion`
- **Polished appearance** - gradient background, smooth animations, clear typography
- **Account display** - shows signed-in player name and email
- **Sign-out button** - prominent, always available

## API Endpoints

All game endpoints require a `Bearer` token in the `Authorization` header.

### Authentication
- `POST /api/sign-in` - Sign in with email and password
- `POST /api/sign-out` - Revoke current token and all others for this account

### Game State
- `GET /api/game` - Get current game state (board, status, history, scores)

### Mutations
- `POST /api/move` - Drop a piece in a column
- `POST /api/undo` - Undo the last move
- `POST /api/redo` - Redo an undone move
- `POST /api/new-game` - Start a new game (preserves match totals)

### Archive
- `GET /api/archive` - List completed matches (latest 10)
- `GET /api/archive/:matchId` - Get a specific match for replay

### Health
- `GET /api/health` - Health check (returns `{ status: "ready" }`)

## Database

SQLite database at `/app/dropline.db` contains:

- **accounts** - User accounts (email, name, password_hash)
- **sessions** - Active authentication sessions with bearer tokens
- **games** - Current game state for each account
- **moves** - Applied moves in the current round
- **redo_stack** - Undone moves available for redo
- **archives** - Completed matches (result, final board, move count, timestamp)
- **operation_idempotency** - Stores results of mutations for idempotency

## Seed Data

On first run, the application imports:

### Accounts
1. **Avery Morgan** (`avery@dropline.test`)
   - Initial board: Mid-game with Red and Yellow pieces
   - Match totals: 2 Red wins, 1 Yellow win, 1 Draw
   - Applied moves: Red (col 4), Yellow (col 5)
   - Redo stack: Red move available

2. **Jordan Lee** (`jordan@dropline.test`)
   - Initial board: Active game with Red and Yellow pieces
   - Match totals: 1 Red win, 2 Yellow wins, 0 Draws
   - Applied moves: 3 moves (Red, Yellow, Red)
   - Completed matches: 11 archived games (various results)

## Configuration

### Environment Variables

- `PORT` - Server port (default: `3000`)
- `DB_PATH` - SQLite database path (default: `/app/dropline.db`)

## Security

- **Password hashing** - SHA-256 hashing (not production-grade, for demo)
- **Token generation** - Cryptographically random 64-character hex strings
- **Bearer token auth** - All game mutations require valid token
- **Account isolation** - Server enforces account-scoped data access
- **No external authentication** - Self-contained, no hosted services
- **No external storage** - All data in local SQLite database

## Development Notes

The application requires:
- Node.js 22+
- npm packages: express, better-sqlite3, xlsx
- Python 3 and build tools (for better-sqlite3 compilation)

All dependencies are included in `package-lock.json` and installed with `npm install`.

## Testing

### Sign In
```bash
curl -X POST http://localhost:3000/api/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"avery@dropline.test","password":"password123"}'
```

### Make a Move
```bash
curl -X POST http://localhost:3000/api/move \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"column":1,"revision":7,"operationId":"move-1234567890"}'
```

### Get Game State
```bash
curl -X GET http://localhost:3000/api/game \
  -H "Authorization: Bearer TOKEN"
```

See `APP_MANIFEST.md` for complete API documentation.

## Browser UI

The application is entirely vanilla JavaScript - no frameworks or build tools. The UI includes:

- **Sign-in form** - Email and password fields with error display
- **Game board** - 7 columns × 6 rows with visual piece representation
- **Column controls** - Buttons to drop pieces, keyboard accessible
- **Move history** - Chronological list of applied moves
- **Undo/Redo buttons** - With disabled state when unavailable
- **Match statistics** - Red wins, Yellow wins, Draws counters
- **Archive modal** - Browse completed matches with dates and results
- **Replay modal** - View final board of archived matches

All UI elements remain accessible at 375px width with proper focus management and keyboard navigation.
