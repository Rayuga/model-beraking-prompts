# Runtime

Build in `/app`. Start with `node /app/server.js` from `/app`, on port 3000.
Use `/app/public/index.html` for the UI and SQLite at `/app/utilibill.db`, or the supplied `DB_PATH`.
`GET /api/health` must succeed once ready. Only `/app` is retained as the application artifact.
Copy required reference data into `/app` during implementation; `/assets` and `/instructions` may be absent at runtime.
Express 5.1.0 and better-sqlite3 12.4.1 are installed globally with NODE_PATH configured.
Public networking is available. The supplied rates and stored reference moment govern all business calculations.
