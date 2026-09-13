# DropLine Application Manifest

## Start Command
`node /app/server.js`

## Database
SQLite path: /app/dropline.db

## Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `POST /api/auth/signin` - Sign in with email and password, returns Bearer token, user info, game state, and match archive
- `POST /api/auth/signout` - Revokes all active bearer tokens for the authenticated account
- `GET /api/auth/me` - Authenticates bearer token, returns user profile, current game state, and match archive

### Game State & Mutations
- `GET /api/game` - Reads current game state and match archive for authenticated account
- `POST /api/game/move` - Applies a column move (1-7), validates gravity and win/draw, supports idempotency and concurrency checking
- `POST /api/game/undo` - Undoes the most recent applied move, reverts score on terminal moves, updates archive
- `POST /api/game/redo` - Redoes the undone move, restores score and archive on terminal moves
- `POST /api/game/new` - Starts a new round, resets board while preserving match totals and archive
