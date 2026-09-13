# DropLine App Manifest

Start command: `node /app/server.js`

SQLite path: /app/dropline.db

Browser entry point: `/app/public/index.html`

Routes:
- Sign in: `POST /api/sign-in`
- Sign out: `POST /api/sign-out`
- Read current game state: `GET /api/state`
- Start new game: `POST /api/new-game`
- Make move: `POST /api/move`
- Undo move: `POST /api/undo`
- Redo move: `POST /api/redo`
- Archive summary: `GET /api/archive`
- Archive replay detail: `GET /api/archive/:matchId`
- Health: `GET /api/health`
