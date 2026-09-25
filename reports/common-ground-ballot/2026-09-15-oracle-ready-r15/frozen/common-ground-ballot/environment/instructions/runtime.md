# Runtime

Public networking is available during implementation and runtime. External fonts,
scripts, styles and API resources are permitted.

- Use Node.js 22, Express, and better-sqlite3, which are already installed.
- Run one process with `node /app/server.js` from `/app`, on port 3000,
  listening on `0.0.0.0`, and serve the browser UI at that address.
- `GET /api/health` should answer successfully.
- Honor `DB_PATH` when provided; otherwise store SQLite at `/app/commonground.db`.
- Keep sessions, ballots, votes, participation, membership, operation receipts,
  and audit activity in SQLite so accepted work survives restart.
- During implementation copy the supplied seed to `/app/common_ground_seed.json`.
  Honor `SEED_PATH` if supplied; otherwise use that embedded seed file.
- Only `/app` is retained as the finished application. `/assets` and
  `/instructions` are build-time inputs and may be absent at startup.
