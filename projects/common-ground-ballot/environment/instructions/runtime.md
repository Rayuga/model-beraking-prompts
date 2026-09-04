# Local runtime

- Use Node.js 22, Express, and `better-sqlite3`, which are already installed.
- Run one process with `node /app/server.js` on port 3000, listening on
  `0.0.0.0`, and serve the browser UI from the same origin.
- `GET /api/health` should answer successfully.
- Honor `DB_PATH` when provided; otherwise store SQLite at
  `/app/commonground.db`.
- Keep sessions, ballots, votes, participation, membership, operation receipts,
  and audit activity in SQLite so accepted work survives restart.
- Copy the supplied seed to `/app/common_ground_seed.json`.
- Bundle browser assets locally. Do not require a CDN, remote font, public API,
  runtime package installation, or another service.
