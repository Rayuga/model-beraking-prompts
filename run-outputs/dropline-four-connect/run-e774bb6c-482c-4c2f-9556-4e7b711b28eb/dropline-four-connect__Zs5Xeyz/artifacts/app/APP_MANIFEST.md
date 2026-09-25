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
| GET | /api/analysis | List the account's saved analyses |
| POST | /api/analysis | Fork a completed match at a replay step |
| GET | /api/analysis/:id | Read an owned analysis and all positions |
| POST | /api/analysis/:id/actions | Move, undo, redo, select or rename an analysis |
| GET | /api/analysis/:id/compare?left=:node&right=:node | Compare two nodes without saving changes |
| POST | /api/analysis-tools/transplant/preview | Validate a source subtree at a destination; save an owner-private revision-bound preview |
| POST | /api/analysis-tools/transplant/commit | Atomically apply a preview with a durable operation receipt |
| POST | /api/analysis/:id/tactics | Read-only depth-1-through-4 tactical report and complete explanation tree |

Mutations include `revision` and `mutationId`; moves also include `column`.
Protected routes use the issued Bearer token. Archive replay uses the immutable
match snapshots returned by GET /api/game and never writes the active game.

Analysis creation uses name, matchId, step and operationId. Analysis edits use
action, expectedRevision, operationId and the action's column, nodeId, childId
or name. These revisions and receipts are separate from competitive games.

Preview body: sourceStudyId, sourceNodeId, destinationStudyId, destinationNodeId.
Commit body: previewId, operationId. Tactics body: nodeId, depth.
