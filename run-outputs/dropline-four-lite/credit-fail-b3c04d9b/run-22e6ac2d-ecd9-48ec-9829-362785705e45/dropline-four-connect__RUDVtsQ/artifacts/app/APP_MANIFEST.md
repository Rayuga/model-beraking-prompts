# DropLine

Start: `node /app/server.js`

```bash
node /app/server.js
```

SQLite path: /app/dropline.db

| Method | Path | Purpose |
| --- | --- | --- |
| GET | / | Browser game |
| GET | /api/health | Server readiness |
| POST | /api/login | Issue a bearer session |
| POST | /api/logout | Revoke all sessions for the account |
| GET | /api/game | Account identity, current state, latest ten matches and total archive count |
| POST | /api/game/new | New round, preserving totals and archive |
| POST | /api/game/move | Drop a piece into a one-based column |
| POST | /api/game/undo | Undo the latest applied move |
| POST | /api/game/redo | Restore the latest undone move |

Mutations include `revision` and `mutationId`; moves also include `column`.
Protected routes use the issued Bearer token. Archive replay uses the immutable
match snapshots returned by GET /api/game and never writes the active game.
