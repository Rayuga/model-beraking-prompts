# Threadline Team Chat

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

## Persistence

- Engine: SQLite via Node built-in `node:sqlite`
- Path: `/app/data/threadline.db`
- Seed source: `/assets/threadline_seed.json`
- Schema and seed initialization are idempotent.

## Main API routes

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Start a tab-scoped authenticated session |
| POST | `/api/auth/logout` | Revoke the current session |
| GET | `/api/bootstrap` | Current user, workspace, channels, unread state |
| POST | `/api/direct-messages` | Start or reopen a one-to-one conversation |
| GET/POST | `/api/channels/:id/messages` | Read or send channel messages |
| GET/POST | `/api/messages/:id/replies` | Read or send thread replies |
| PATCH/DELETE | `/api/messages/:id` | Versioned edit or delete |
| POST | `/api/messages/:id/reactions` | Toggle a user's reaction |
| POST | `/api/messages/:id/pin` | Pin or unpin a message |
| POST | `/api/channels/:id/read` | Update the user's read position |
| GET | `/api/search` | Search accessible messages and replies |
| GET | `/api/events` | Live event and presence stream |
| POST | `/api/typing` | Publish a typing indicator |
| POST | `/api/hooks/:token` | Idempotent incoming webhook delivery |

## Seeded sign-in

All seeded users use the password `northstar`.
