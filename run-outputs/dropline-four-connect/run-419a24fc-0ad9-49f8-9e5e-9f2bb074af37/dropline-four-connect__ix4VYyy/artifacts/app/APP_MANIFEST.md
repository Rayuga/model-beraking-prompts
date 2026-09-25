# DropLine manifest

## Runtime
- Start the server with `node /app/server.js`
- Backend listens on port `3000`
- Static browser assets are served from `/app/public/index.html`
- Durable storage lives in `/app/dropline.db`

## Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout-all`
- `GET /api/bootstrap`

## Competitive game
- `POST /api/game/move`
- `POST /api/game/undo`
- `POST /api/game/redo`
- `GET /api/archive/:matchId`

## Practice analyses
- `POST /api/analysis/from-match`
- `GET /api/analysis/:analysisId`
- `POST /api/analysis/:analysisId/rename`
- `POST /api/analysis/:analysisId/select`
- `POST /api/analysis/:analysisId/move`
- `POST /api/analysis/:analysisId/undo`
- `POST /api/analysis/:analysisId/redo`
- `POST /api/analysis/compare`
- `POST /api/analysis/preview-branch`
- `POST /api/analysis/commit-branch`
- `POST /api/analysis/report`

## Seeded accounts
- `avery@dropline.test` / `password123`
- `jordan@dropline.test` / `password123`
