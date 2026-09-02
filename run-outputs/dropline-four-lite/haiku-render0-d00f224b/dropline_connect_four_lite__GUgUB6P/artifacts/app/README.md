# DropLine - Connect Four Game

A polished, fully-functional Connect Four game for two players sharing one browser, with real authentication, persistent game state, and move history with undo/redo functionality.

## Features

- **Real Authentication**: Bearer token-based authentication with SQLite storage
- **Persistent Game State**: All game data persists in SQLite database
- **Account Isolation**: Each account maintains separate game state and match totals
- **Move History**: Complete chronological record of all moves in the current round
- **Undo/Redo**: Full undo and redo support that persists to the database
- **Win/Draw Detection**: Automatic detection of wins and draws
- **Match Totals**: Cumulative scores tracked across rounds
- **Responsive Design**: Works on mobile (375px) and desktop screens
- **Keyboard Navigation**: Full keyboard support for accessibility
- **No External Dependencies**: All assets and scripts are served locally

## Installation & Setup

No runtime installation required. The application comes with all dependencies pre-installed.

### Starting the Server

```bash
node /app/server.js
```

The server will:
- Listen on port 3000
- Create/initialize SQLite database at `/app/dropline.db`
- Serve the web interface from `/app/public/index.html`

## Demo Accounts

Two demo accounts are pre-configured:

- **Email**: avery@dropline.test | **Password**: password123
- **Email**: jordan@dropline.test | **Password**: password123

## Architecture

### Backend (Node.js + Express + SQLite)
- **Server**: `/app/server.js`
- **Database**: `/app/dropline.db` (SQLite)
- **API Endpoints**:
  - `POST /api/auth/login` - Sign in with email and password
  - `POST /api/auth/logout` - Sign out and revoke token
  - `GET /api/game` - Get current game state
  - `POST /api/game/move` - Make a move in the game
  - `POST /api/game/undo` - Undo the last move
  - `POST /api/game/redo` - Redo an undone move
  - `POST /api/game/new` - Start a new game round
  - `GET /health` - Health check endpoint

### Frontend (Vanilla HTML, CSS, JavaScript)
- **HTML**: `/app/public/index.html` - Markup and structure
- **CSS**: `/app/public/style.css` - Styling and responsive layout
- **JavaScript**: `/app/public/client.js` - Game logic and interaction

### Database Schema
- **accounts**: User credentials and names
- **tokens**: Active authentication tokens
- **games**: Game state per account
- **moves**: Individual moves with color, column, and landing row

## Game Rules

- **Board**: 7 columns × 6 rows
- **Starting State**: Empty board, Red plays first
- **Move**: Drop a piece in a column; it falls to the lowest empty cell
- **Win Condition**: Four in a row (horizontal, vertical, or diagonal)
- **Draw**: All 42 cells filled with no winner
- **Turn Alternation**: Red and Yellow alternate each valid move
- **Terminal State**: Game rejects moves once finished

## Features in Detail

### Authentication
- Email/password sign-in with visible error feedback
- Bearer token authentication for game operations
- Tokens are revoked on sign-out
- Expired tokens are rejected

### Game State Persistence
- Every move is persisted before reporting success
- Game state reconstructed from move history
- Reload restores exact board, turn, results, scores, and redo availability

### Move History
- Chronological list of moves in current round
- Shows move number, color, column, and landing row
- Undone moves are visually marked

### Undo/Redo
- Remove most recent applied move with undo
- Restore undone moves with redo
- Undo turn goes back to the player who made the undone move
- Winning/draw moves properly adjust scores when undone/redone
- New move after undo clears redo stack

### Match Totals
- Red wins, Yellow wins, and Draws tracked
- Preserved across rounds
- Reset only when starting a completely new session

## Accessibility

- Full keyboard navigation (arrows, Home, End, Enter, Space)
- ARIA labels on all interactive elements
- Screen reader support for game state
- Respects `prefers-reduced-motion` CSS media query
- Grid-based board structure with semantic markup

## Browser Support

Works on any modern browser with:
- ES6 JavaScript support
- CSS Grid and Flexbox
- Fetch API
- LocalStorage for session persistence

## Testing

The application includes comprehensive test coverage:
- `test_dropline.sh` - Basic game flow (move, undo, redo, new game)
- `test_win.sh` - Win scenario with undo/redo of winning moves
- `test_account_switch.sh` - Account isolation and data persistence
- `final_test.sh` - System endpoints and basic functionality

## Development Notes

- No external APIs or CDNs required
- All HTML, CSS, and JavaScript are served locally
- Database is SQLite for reliable local persistence
- Authentication uses secure random tokens
- Move validation happens server-side only
- Game logic is deterministic and can be replayed

## Performance

- Typical response time: <50ms for game operations
- Board can handle 42 moves without latency
- Token validation is O(1)
- Move history retrieval is O(n) where n = moves in round (max 42)
