# Brickfall - Arcade Brick Breaker Game

A full-featured brick-breaker arcade game with real authentication, persistent player profiles, and a mechanics lab for testing game systems.

## Quick Start

### Prerequisites
- Node.js 14+
- npm

### Installation & Running

```bash
cd /app
npm install
node server.js
```

The server will start on `http://localhost:3000`

## Features

### Core Gameplay
- **10 Progressive Levels**: Each level increases in difficulty with higher ball speeds and complex brick layouts
- **Predictable Physics**: Fixed 1/120-second timestep with swept circle collision detection
- **Ball Mechanics**: 
  - Launch from paddle with Space key
  - Paddle steering based on impact position
  - Multiple ball support (multiball power-up)
  - Sticky ball mechanic for controlled launches
- **Brick Types**:
  - Normal bricks: One hit, worth 100 base points
  - Strong bricks: Two hits (75 points for damage, 250 for destruction)
  - Solid bricks: Unbreakable barriers
- **Scoring System**:
  - Base points multiplied by combo (up to ×5)
  - Extra life every 20,000 points (tracked per run)
  - Level completion bonus: 1,000 × level number

### Power-Ups (20-second duration each)
- **Wide**: Paddle becomes 50% wider
- **Slow**: All balls reduced to 70% speed
- **Multiball**: Extra ball spawned (max 2 total)
- **Sticky**: Ball sticks to paddle until launched

### Player Management
- **Persistent Authentication**: Bearer token authentication with SQLite storage
- **Player Profiles**:
  - Highest unlocked level per player
  - Best score tracking
  - Three demo accounts pre-seeded (Mira, Dev, Polly)
  - All passwords: `password123`
- **Session Persistence**: Token stored in localStorage, restored on page reload
- **Multi-Tab Safety**: Token-based authentication prevents accidental data conflicts

### Run Management
- **Active Run State**: Save and restore mid-game with full state persistence
- **Idempotent Operations**: Retrying actions (reload, network retry) never duplicates results
- **Revision Tracking**: Monotonic revision numbers prevent stale updates from overwriting newer state
- **Run History**: Last 10 completed runs per player with full snapshots

### Leaderboard
- **Global Top 10**: Sorted by score (descending), then by achievement time
- **Player Initials**: Display player's stored three-letter initials
- **Persistent Results**: Every completed run adds to the leaderboard

### Mechanics Lab
- **Interactive Drills**: Test specific game mechanics without affecting scores
- **Drill Types**:
  - Brick types and collision behavior
  - Power-up relay and stacking
  - Multiball mechanics
  - Sticky catch timing
  - Extra life thresholds
  - Last ball scenario
  - Final wall (Level 10 completion)
- **Telemetry Display**: View current phase, score, lives, combo, and step counter
- **Advance Controls**: Step through the engine up to 1 second (120 steps) at a time

### Interface
- **Responsive Design**: Playable at 375px minimum width
- **Arcade Theme**: Dark theme with accent colors matching each level
- **Keyboard Controls**:
  - `←` / `→`: Move paddle
  - `Space`: Launch ball
  - `P` / `Esc`: Pause
  - `R`: Restart after game over
- **Touch Support**: Mouse/touch steering for paddle
- **Assist Paddle**: Optional slower-moving paddle for accessibility
- **Events Log**: Recent game events (collected items, collisions, scores)

## Architecture

### Backend Stack
- **Express.js**: Web framework
- **SQLite3**: Persistent storage with migration from Excel seed data
- **Node.js**: Runtime

### Frontend Stack
- **Vanilla JavaScript**: No frameworks
- **HTML5 Canvas**: Game rendering with pixel-perfect graphics
- **CSS Grid/Flexbox**: Responsive layout

### Key Files
```
/app/
├── server.js              # Express server & API endpoints
├── db.js                  # SQLite schema, seeding, queries
├── auth.js                # Token generation & authentication
├── physics.js             # Physics engine (reserved for future use)
├── package.json           # Dependencies
├── brickfall.db           # SQLite database (auto-created)
├── public/
│   ├── index.html         # Main UI
│   ├── css/style.css      # Styling
│   └── js/client.js       # Game logic & rendering
└── README.md              # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in with email/password
- `POST /api/auth/signout` - Revoke all active tokens

### Game State
- `GET /api/game/state` - Get active run (if any)
- `POST /api/game/start` - Start new run at level
- `POST /api/game/save` - Save current run state
- `POST /api/game/finish` - End run and update leaderboard

### Levels
- `GET /api/levels` - List all levels and unlocked status
- `GET /api/levels/:level/bricks` - Get brick layout for level

### Leaderboard & History
- `GET /api/leaderboard` - Top 10 global scores
- `GET /api/leaderboard/history` - Player's 10 most recent runs

### Mechanics Lab
- `GET /api/lab/drills` - List all available drills
- `GET /api/lab/drill/:id` - Load specific drill
- `POST /api/lab/advance` - Advance drill by up to 1 second
- `GET /api/lab/constants` - Game constants (lives, speeds, etc.)

## Database Schema

### Core Tables
- **users**: Player accounts with password hashes
- **tokens**: Active bearer tokens for authentication
- **levels**: Level definitions (name, speeds, colors)
- **bricks**: Level brick layouts with power-up drops
- **runs**: Active and completed player runs
- **run_history**: Archive of last 10 runs per player
- **leaderboard**: Global scores
- **drills**: Mechanics lab test scenarios
- **operation_receipts**: Idempotence receipts for operations

## Data Seeding

The application auto-seeds on first run with:
- **Excel seed data** (`/assets/artifacts/brickfall_seed.xlsx`):
  - 3 demo users: Mira Chen, Dev Patel, Polly Green
  - 10 complete levels with brick layouts
  - 5 global leaderboard entries
  - Game constants (lives, speeds, point values)
  
- **JSON scenarios** (`/assets/artifacts/brickfall_scenarios.json`):
  - 7 mechanics lab drills with expected outcomes
  - Paused checkpoint states for Mira & Dev
  - Polly's run history (last 10 runs)
  - Guest leaderboard fixtures

## State Management & Persistence

### Run Lifecycle
1. **Start**: Player selects level → new run created with revision 0
2. **Playing**: Ball physics updated at 1/120 second intervals
3. **Saving**: State auto-saved every 1 second during play
4. **Paused**: Time frozen, can resume
5. **Life Lost**: Reset ball, continue if lives remain
6. **Level Complete**: Score bonus, unlock next level, advance
7. **Game Over**: Final lives lost → save result & update leaderboard
8. **Completed**: Level 10 finished → game complete

### Idempotency
Every mutation (start, save, finish) includes:
- Expected revision (prevents stale updates)
- Unique operation ID (prevents accidental duplicates)
- Transaction-level UNIQUE constraint

If a retry occurs:
- Same operation ID → return cached response
- Stale revision → return 409 with current state
- Client auto-reconciles and explains which revision won

### Persistence Across Tabs
- Token stored in localStorage
- Each signed-in tab has independent token
- Server keeps only active tokens
- Sign-out revokes all tokens for the account
- Logout in one tab doesn't affect others (until page refresh)

## Physics Engine

### Timestep
- **Fixed**: 1/120 second (8.33ms)
- **Accumulator**: Handles variable frame rates
- **Bounded**: Max 5 substeps per frame to prevent spiral of death

### Collision Detection
- **Circle vs Rectangle**: Simplified distance-based detection
- **Swept Collision**: Prevents ball tunneling through thin bricks
- **Bounce Response**: Reflects off nearest surface

### Ball Properties
- **Radius**: 6 pixels
- **Min Speed**: 100 pixels/second
- **Max Speed**: Level-dependent cap (520-745 pixels/second)
- **Steering**: Impact position on paddle changes outgoing angle

### Paddle Mechanics
- **Base Width**: 118 pixels (50% more with wide power-up)
- **Speed**: 400 pixels/second
- **Interaction**: Ball bounces + combo reset on contact

## Game Constants

These are defined in the seed data and accessible via `/api/lab/constants`:
- `initial_lives`: 3
- `extra_life_threshold`: 20000 points
- `combo_max`: 5
- `normal_brick_base_points`: 100
- `strong_brick_damage_points`: 75
- `strong_brick_destroy_points`: 250
- `level_completion_bonus`: 1000
- `power_up_duration`: 20 seconds
- `wide_paddle_multiplier`: 1.5
- `slow_ball_speed_multiplier`: 0.7

## Accessibility Features

- **Keyboard Shortcuts**: All actions accessible via keyboard
- **Screen Reader Friendly**: Canvas has accessible name/description
- **Color Not Required**: Brick types distinguishable by appearance
- **Focus States**: Visible focus indicators on all buttons
- **Assist Paddle**: Optional slower paddle (doesn't affect scoring)
- **Touch Support**: Full touch controls for mobile

## Development Notes

### Extending the Game

To add new levels, modify the Excel seed file and re-import:
```
1. Add row to `Levels` sheet with: level, name, base_speed, speed_cap, accent
2. Add rows to `Bricks` sheet with: level, row, column, type, drop
3. Delete brickfall.db to trigger re-seed
4. Restart server
```

To add new power-ups:
```
1. Define mechanic in `updatePhysics()` with 20-second timer
2. Handle collection in `applyPowerUp()`
3. Add reset logic when timer expires
4. Create drill test in JSON scenarios
```

### Testing the Mechanics Lab

Load the "Brick types" drill to verify:
- All brick types render correctly
- Collision responses are correct
- Power-ups spawn from destroyed bricks
- Scoring formula is accurate

## Known Limitations

- Audio: Not implemented (spec: "no audio needed")
- Multiplayer: Single-player only (per spec)
- Payments: No in-app purchases
- Registration: Only pre-seeded demo accounts
- Physics: Simplified collision vs full swept sphere
- Graphics: Canvas-based, no GPU acceleration

## Performance

- **Rendering**: 60 FPS target via requestAnimationFrame
- **Physics**: 120 fixed steps/second independent of render rate
- **Database**: SQLite file-based, single connection
- **Memory**: Run state compressed in localStorage
- **Network**: Auto-save throttled to 1 second intervals

## Troubleshooting

### "Unauthorized" error
- Token expired or revoked
- Clear localStorage: `localStorage.removeItem('brickfall_token')`
- Sign in again

### Game won't start
- Level not unlocked (only playable levels show as clickable)
- Active run exists (resume or abandon first)
- Check browser console for errors

### Physics feels wrong
- Verify 1/120 timestep in physics.js
- Check collision rect dimensions match brick rendering
- Ensure paddle steering is applied consistently

### Database error
- Delete brickfall.db to force re-seed
- Ensure /assets/artifacts/*.xlsx and *.json exist
- Check file permissions

## License

Brickfall © 2026. Built with vanilla HTML, CSS, JavaScript, Node.js, and SQLite.
