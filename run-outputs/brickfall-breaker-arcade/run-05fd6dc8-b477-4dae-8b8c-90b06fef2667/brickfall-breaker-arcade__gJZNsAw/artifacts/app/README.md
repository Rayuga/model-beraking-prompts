# Brickfall - Arcade Brick Breaker Game

A fully-featured brick-breaker arcade game with player authentication, persistent game state, and proper physics.

## Features

- **Authentication**: Secure sign-in with bearer tokens
- **Persistent State**: Game state automatically saved and restored across browser sessions
- **10 Levels**: Progressive difficulty with unique layouts
- **Physics Engine**: Realistic ball physics with swept collision detection
- **Power-ups**: 
  - Wide Paddle (50% wider)
  - Slow (70% slower ball speed)
  - Multiball (extra ball)
  - Sticky (catch and release mechanic)
- **Scoring System**: 
  - Combo multiplier (up to x5)
  - Extra lives at 20,000-point thresholds
  - Level bonuses
- **Leaderboard**: Top 10 scores tracked globally
- **Multi-tab Support**: Proper synchronization prevents data loss across multiple browser tabs

## Running the Game

### Requirements
- Node.js v18+ with npm
- No additional installations needed at runtime

### Starting the Server

```bash
cd /app
npm install  # Install dependencies (only needed once)
node server.js
```

The game will be available at: **http://localhost:3000**

## Demo Accounts

Three pre-seeded accounts are available:

| Email | Password | Status |
|-------|----------|--------|
| mira@brickfall.test | password123 | Expert (10 levels unlocked) |
| dev@brickfall.test | password123 | Intermediate (3 levels unlocked) |
| polly@brickfall.test | password123 | Veteran (10 levels unlocked) |

## Game Controls

### Mouse/Touch
- **Move**: Pointer movement
- **Launch**: Spacebar

### Keyboard
- **Move Left**: Left Arrow or A
- **Move Right**: Right Arrow or D
- **Launch**: Spacebar
- **Pause**: P or Escape
- **Restart** (game over): R

### Touch
- **Move**: Touch and drag
- **Launch**: Tap launch button

## Game States

1. **Menu**: Select a level to play
2. **Ready**: Paddle ready, waiting to launch
3. **Playing**: Ball in motion, break bricks
4. **Paused**: Game frozen, can resume
5. **Life Lost**: Ball lost, preparing for next serve
6. **Level Complete**: All bricks broken, can advance
7. **Game Over**: No lives remaining
8. **Completed**: Level 10 finished

## Game Mechanics

### Scoring
- Normal bricks: 100 points (or 75 for strong bricks' first hit)
- Strong bricks (damaged): 250 points
- Solid bricks: No points
- Combo multiplier: x1 to x5
- Level bonus: Level × 1000 points

### Lives
- Start with 3 lives
- Lose a life when all balls are gone
- Extra life awarded every 20,000 points
- Game over when lives reach 0

### Power-ups
- **Wide**: Makes paddle 50% wider for 20 seconds
- **Slow**: Reduces ball speed to 70% for 20 seconds
- **Multiball**: Creates one additional ball
- **Sticky**: Catches next paddle contact until Launch is pressed

### Physics
- Fixed timestep physics (1/120 second)
- Swept collision detection prevents ball tunneling
- Ball velocity clamped to level speed cap
- Minimum useful horizontal/vertical component maintained
- Paddle contact steers ball angle
- Recent paddle motion adds horizontal push

## Database

Game state is persisted to SQLite database at `/app/brickfall.db`:
- User accounts and authentication
- Active and completed runs
- Leaderboard scores
- Run history (10 per user)
- Level definitions and brick layouts

## Architecture

- **Server**: Express.js (Node.js)
- **Database**: SQLite with WAL mode
- **Frontend**: Vanilla JavaScript with Canvas API
- **Physics**: Custom 2D collision detection
- **Styling**: CSS with arcade theme

## File Structure

```
/app/
├── server.js           # Express server and API routes
├── db.js              # Database initialization and operations
├── brickfall.db       # SQLite database (auto-created)
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Main game UI
│   ├── css/
│   │   └── style.css  # Game styling
│   └── js/
│       ├── api.js     # API communication
│       ├── game.js    # Game engine
│       └── ui.js      # UI management
└── README.md          # This file
```

## API Endpoints

All endpoints require authentication with Bearer token.

### Authentication
- `POST /api/sign-in` - Sign in with email and password
- `POST /api/sign-out` - Sign out and revoke token

### Game State
- `GET /api/game-state` - Get current player state, levels, and leaderboard
- `POST /api/start-run` - Start a new run on a level
- `POST /api/save-run` - Save current game state
- `POST /api/finish-run` - Finish a run and update leaderboard

## Persistence Features

### Revision Tracking
Each run has a monotonic revision number. Every mutation carries:
- Expected revision
- Fresh operation ID

This prevents:
- Race conditions between tabs
- Duplicate submissions (idempotent operations)
- Data loss from out-of-order requests

### Multi-Tab Coordination
- Tokens stored in localStorage
- Window focus handler checks for state updates
- Stale revision (409) responses reconcile state
- Pending actions suppressed during sync

### Save Throttling
- Game state saved every 5 seconds during gameplay
- Automatic save on pause, level complete, and game over
- No redundant saves within throttle window

## Gameplay Tips

1. **Combo Management**: Hit bricks consecutively to build combo multiplier (up to x5)
2. **Power-ups**: Strategic use of wide and slow power-ups makes tough levels easier
3. **Paddle Angle**: Hit the ball on the edge of the paddle for extreme angles
4. **Reuse Sticky**: Sticky power-up can be collected again while active to refresh timer
5. **Multiball Strategy**: Extra balls don't affect scoring, just increases survival chance

## Troubleshooting

### Game not starting
1. Ensure Node.js is installed: `node --version`
2. Check server is running: `curl http://localhost:3000`
3. Check browser console for errors (F12)

### Game state not saving
1. Check browser allows localStorage
2. Verify server is running (check `/tmp/server.log`)
3. Try clearing localStorage and reloading: `localStorage.clear()`

### Slow performance
1. Close other browser tabs
2. Check CPU usage (game uses requestAnimationFrame)
3. Try fullscreen mode for better frame rate

## Development

### Adding New Levels
Edit `/assets/artifacts/brickfall_seed.xlsx`:
1. Add row to `Levels` sheet with level number, name, base_speed, speed_cap, accent
2. Add brick definitions to `Bricks` sheet
3. Reinitialize database: delete `brickfall.db` before starting server

### Debugging Physics
Game includes detailed telemetry:
- Physics timestep: 1/120 second
- Ball position and velocity logged each frame
- Collision detection debug info available

## Performance Notes

- Canvas rendering: 60 FPS target
- Physics simulation: 120 FPS fixed timestep
- Database: WAL mode for concurrent access
- Token expiry: One active token per user

## License

Created as an arcade game for entertainment and educational purposes.
