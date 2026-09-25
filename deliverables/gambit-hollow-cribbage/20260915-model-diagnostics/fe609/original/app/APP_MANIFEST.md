# Gambit Hollow app manifest

```bash
# start
node serve.js
# SQLite runtime
/app/gambit.db
# main read routes
GET /api/health
GET /api/bootstrap
GET /api/ladder
GET /api/history
GET /api/history/:id
GET /api/games
GET /api/games/:id?seat=A
# scoring bench is client-side through the bootstrap payload
# game action routes
POST /api/games
POST /api/games/:id/actions
# action headers
X-Action-Id: <client-generated-uuid>
X-Expected-Revision: <revision-seen-by-the-browser>
```

Notes:
- `GET /api/games/:id` includes the current revision and a seat-redacted view.
- `GET /api/bootstrap` includes the ladder, saved games, historical summaries, practice deals, and scored-hand references.
- `POST /api/games` creates a new game; `POST /api/games/:id/actions` applies discard/play/go/next_hand mutations.
- `GET /api/history` is the historical-summary read route; `GET /api/history/:id` reads one preserved summary.
- The browser stores a pending action id/body locally so an interrupted save can be retried with the same headers.
