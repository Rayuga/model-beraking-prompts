# Gambit Hollow Application Manifest

## Server Start Command

```bash
node serve.js
```

## Database Storage

- Absolute SQLite Path: `/app/gambit.db` (also honors `process.env.DB_PATH` when configured).

## Action Identifier and Revision Protocol

- **Action Identifiers**: Every mutating request (`POST /api/games` or `POST /api/games/:id/action`) carries a client-generated unique identifier passed either in the HTTP header `X-Action-Id: <uuid>` or in the request JSON body property `action_id`.
  - Retrying an identical request with the same `action_id` and payload returns the saved receipt without applying the mutation twice.
  - Reusing an existing `action_id` with different input or target game returns `409 Conflict`.
- **Revisions**:
  - Every game read (`GET /api/games/:id` or `GET /api/games`) exposes the game's non-negative integer `revision` property (starting at `0` on creation).
  - Each accepted mutating action on a game advances `revision` by `+1`.
  - Game action requests (`POST /api/games/:id/action`) supply `expected_revision` in the JSON body.
  - If `expected_revision` does not match the server's current `revision`, the server refuses the request with `409 Conflict` (`error: 'stale_revision'`), leaving the game and ladder intact.

## API Routes

### Health & System
- `GET /api/health` — Service availability probe, returns `{ status: 'ok', time: '...' }`.

### Club Records & Ladder
- `GET /api/members` — List club members with played and won counts.
- `GET /api/ladder` — Club ladder rankings with member stats and match target (121).
- `GET /api/history` — Historical game summaries including original seed records and completed games.

### Scoring Bench
- `GET /api/reference-hands` — Reference collection of all forty scored hands.
- `GET /api/practice-deals` — Dictionary of fixed practice deals and complete match series.
- `POST /api/score/hand` — Hand & Crib scoring calculation (`hand`, `cut`, `crib`). Returns total and breakdown for fifteens, pairs, runs, flush, nobs.
- `POST /api/score/pegging` — Pegging play calculator (`cards` or `pile` + `next_card`). Returns running count (up to 31), points scored, and reasons.

### Games & Play
- `GET /api/games` — List active, playable saved games.
- `POST /api/games` — Create a new game (supports standard shuffle or practice deals with starting scores 0..120).
- `GET /api/games/:id` — Read current game state filtered for seat privacy (`?seat=A` or `?seat=B`), exposing `revision`.
- `POST /api/games/:id/action` — Submit game action (`discard`, `play_card`, `go`, `next_hand`).
