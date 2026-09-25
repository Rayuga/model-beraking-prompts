# Gambit Hollow app manifest

```bash
node serve.js
```

- SQLite database: `/app/gambit.db`
- The server also honors `DB_PATH` for a relocated runtime database.
- Health probe: `GET /api/health`

## Main read routes

- `GET /api/bootstrap` — members, open games, history, practice data, scoring examples
- `GET /api/games` — all games plus the open-game chooser list
- `GET /api/games/:id?viewer=A|B` — read one game from a seat view and get its nonnegative revision
- `GET /api/history` — historical summaries
- `GET /api/history/:id` — one historical summary record

## Scoring routes

- `POST /api/score/hand`
  - body: `{ "hand": ["5S","5H","5D","JC"], "cut": "5C", "crib": false }`
  - returns total plus fifteens, pairs, runs, flush and nobs
- `POST /api/score/pegging`
  - body: `{ "pile": ["7H","TH"], "card": "2S" }`
  - returns count before/after, points, reasons and pegging breakdown

## Game action routes

- `POST /api/games`
  - body includes `actionId`, `mode`, `practiceKey`, `members`, `scores`, and `dealer`
  - creating a game is idempotent on `actionId`
- `POST /api/games/:id/actions`
  - body includes `actionId`, `expectedRevision`, `seat`, `type`, and action-specific fields
  - supported types: `discard`, `play`, `go`, `next-hand`
  - the browser sends a client-generated `actionId` and the revision it last read
  - repeated identical requests return the original acceptance; stale revisions are refused

## Reading revisions

Every game read exposes `revision` in the JSON payload from `GET /api/games/:id` and the chooser routes. The client reads that value and sends it back as `expectedRevision` for all mutating game actions.
