# How we run it

We run one Node 22 process with Express and better-sqlite3 already available
through NODE_PATH; only those packages and Node built-ins are used. The
process starts from /app/server.js, listens on port 3000 on 0.0.0.0, and
serves both the browser UI and the API. We copy the supplied seed data to
/app/seed_data.json and keep the SQLite database at /app/bazaarbridge.db,
honoring DB_PATH when we set it. Restarting the process over the same database
file keeps our data. GET /api/health answers before database work can block
startup so our tooling can tell the process is alive.

A fresh browser at http://localhost:3000/ with no cookies lands on a usable
sign-in screen. The product is served from our local server, and it may pull
external fonts, scripts or CDN assets because our network is public, but it
cannot depend on an external backend or data service. How routes and files are
laid out under /app is up to you.

Time-based rules use one fixed marketplace clock, not the real run date: the seed's top-level
"clock" (2026-09-09T12:00:00Z) is authoritative, and our tooling passes SIMULATION_CLOCK
with the same value as an override. Treat both as the same clock so windows and dates never depend on run date.
