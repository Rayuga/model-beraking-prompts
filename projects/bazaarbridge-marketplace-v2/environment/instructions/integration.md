# Runtime and data

- Node.js 22 with Express and `better-sqlite3` already available through the
  environment (`NODE_PATH`). Use only those packages and Node's built-in
  modules.
- **One process** — a single Express server serving both the browser UI and
  any API on port **3000**, listening on `0.0.0.0`.
- Entry point: `/app/server.js`. Start with `node /app/server.js`.
- Answer `GET /api/health` successfully before any database work can block
  startup, so our deployment tooling can tell the process is alive.
- Persistence: SQLite on disk. Honor `DB_PATH` when it is set; otherwise use
  `/app/bazaarbridge.db`. The database must survive a restart.
- Copy the supplied seed data to `/app/seed_data.json` so everything the app
  needs to boot lives under `/app`.
- Serve all browser assets locally. Do not depend on an external CDN or
  remote stylesheet, script, or font for the product to work.
- Routes, file layout under `/app`, and whether the UI is server-rendered or
  a single-page app are yours to choose. Somebody arriving at
  `http://localhost:3000/` on a fresh browser with no cookies must land on a
  usable sign-in screen.
