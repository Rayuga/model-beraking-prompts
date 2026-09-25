# DropLine Application Manifest

## Start Command
```bash
node /app/server.js
```

## Database
SQLite path: /app/dropline.db

Environment variable `DB_PATH` is honored if provided; otherwise defaults to `/app/dropline.db`.

## Health Check
- `GET /api/health` — Returns server health status `{ "status": "ok", "timestamp": "..." }`.

## Authentication Routes
- `POST /api/auth/login` — Sign in with email and password. Returns bearer token and account details.
- `POST /api/auth/logout` — Revoke active token and all other tokens for the signed-in account (signs out everywhere).
- `GET /api/auth/session` — Get current authenticated session account information.

## Competitive Game Routes
- `GET /api/game` — Read the current account's active Connect Four board, turn/result, winning markers, match scores, applied move history, redo availability, and server revision.
- `POST /api/game/move` — Drop a piece in a column (1–7) with `expectedRevision` and `operationId`. Validates gravity, alternating turns, full-column rejection, win and draw detection, and records completed matches in the archive upon game end.
- `POST /api/game/undo` — Undo the most recent move with `expectedRevision` and `operationId`. Reverses score increments and removes completed matches from the archive if undoing a terminal move.
- `POST /api/game/redo` — Redo the previously undone move with `expectedRevision` and `operationId`. Re-applies score increments and archive records if redoing a terminal move.
- `POST /api/game/new` — Clear current round board, history, and redo stack to start a new game starting with Red's turn, preserving match totals.

## Completed Match Archive & Replay Routes
- `GET /api/archive` — Get total completed match count and the latest 10 matches (newest first) with result, move count, and timestamp.
- `GET /api/archive/:matchId` — Fetch a completed match's full move sequence and final board for read-only replay.

## Branching Analysis Routes
- `GET /api/analyses` — List all private saved analyses for the authenticated account.
- `POST /api/analyses` — Create a new named branching analysis frozen at a specific replay step of a completed match, with `matchId`, `step`, `name`, and `operationId`.
- `GET /api/analyses/:id` — Read full analysis workspace data, including root snapshot, selected node board, turn, result, winning markers, full selected-line history, available continuations, and the variation tree.
- `POST /api/analyses/:id/move` — Drop a piece on the analysis practice board at the current selected node with `column`, `expectedRevision`, and `operationId`. Reopens existing children if the same column is played again from the same parent.
- `POST /api/analyses/:id/undo` — Select parent node in the variation tree with `expectedRevision` and `operationId`.
- `POST /api/analyses/:id/redo` — Select direct child continuation node in the variation tree with `expectedRevision`, `operationId`, and optional `childNodeId` (required when ambiguous).
- `POST /api/analyses/:id/select` — Select any position node in the variation tree with `nodeId`, `expectedRevision`, and `operationId`.
- `POST /api/analyses/:id/rename` — Rename the analysis with `name` (1–60 chars trimmed), `expectedRevision`, and `operationId`.
- `POST /api/analyses/:id/compare` — Compare any two nodes in the analysis (`nodeAId`, `nodeBId`). Returns both complete boards, shared opening moves count, and exact differing cells with row/col coordinates.

## Study Tools: Branch Transplant & Tactical Reports
- `POST /api/analyses/:id/transplant/preview` — Preview transplanting a branch (`sourceNodeId`) onto any destination node (`destAnalysisId`, `destNodeId`). Re-evaluates gravity, alternating turns, wins, and draws afresh; reports relative column paths, new node count, reused node count, or first deterministic illegal move.
- `POST /api/analyses/:id/transplant/commit` — Atomically commit a validated preview into the destination analysis with `previewId` and `operationId`.
- `GET /api/analyses/:id/tactical` & `POST /api/analyses/:id/tactical` — Run bounded minimax tactical search from player-to-move's perspective for depths 1 through 4 plies. Returns forced win/loss/draw/not established recommendations for every legal column, along with a browsable explanation proof tree and 42-cell position inspector data.
