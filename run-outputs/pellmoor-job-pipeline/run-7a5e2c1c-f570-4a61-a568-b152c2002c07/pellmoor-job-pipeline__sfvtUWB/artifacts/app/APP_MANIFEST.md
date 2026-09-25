# Pellmoor runtime

```bash
node /app/backend/server.js
```

SQLite path: /app/pellmoor.db

The server honors DB_PATH and listens on 0.0.0.0:3000. The browser bundle
is built before delivery with npm run build. The seed is read from
/recruitment/records/pellmoor_seed_data.json only on a fresh database.

## Routes

- POST /api/login and POST /api/logout: create and revoke bearer sessions.
- GET /api/me: current authenticated person.
- GET /api/roles and GET /api/roles/:code: vacancies and their snapshots.
- GET /api/candidates/:id: candidate details.
- POST /api/candidates: create a candidate.
- POST /api/roles/:code/batch-preview: read-only assessment and capacity review; candidate_ids only.
- POST /api/roles/:code/batch-offers: atomically offer the ordered candidate_ids with expected_revision and operation_id.
- POST /api/candidates/:id/stage: move a candidate.
- POST /api/candidates/:id/panel: assign a panel member, or remove one with action=remove.
- POST /api/candidates/:id/score: save the authenticated member's score.
- POST /api/candidates/:id/notes: append an attributed note.
- PATCH or DELETE /api/notes/:id, DELETE /api/activity/:id and
  DELETE /api/candidates/:id: reject forbidden destructive changes.
- GET /api/health: readiness.

Each product mutation includes expected_revision and operation_id. These
routes remain local; no external data service is needed at runtime.
