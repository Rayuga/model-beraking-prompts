# Orbital Ops ground-station console

can you build me a polished full-stack ground-station operations console for a four-craft satellite constellation? I need a real backend server and persistent storage, not just a static dashboard — this has to run standalone on the ops floor. Include demo login accounts and show the signed-in person's role.

Let me move between Constellation status, Command queue, Telemetry, and — for administrators — Administration. I should be able to draft, queue, uplink and cancel commands against a spacecraft, watch the constellation board and open anomalies, and review telemetry; authorize high-energy burns and record spacecraft checkout results as a flight director; see only my assigned spacecraft as an analyst; and manage accounts and read the full audit record as an administrator.

The exact contact-window, propellant, battery, checkout, authorization, record-keeping and scope rules are written up in `/docs/orbitalops-commanding.md`, `/docs/orbitalops-authorization.md` and `/docs/orbitalops-record.md` — read all three and follow them precisely. The numbers there are authoritative and override anything a request body or the UI might suggest.

Put the application in `/app`. Build the backend with Node.js and Express, use SQLite for durable storage, and seed it from the provided workbook at `/assets/artifacts/orbitalops_seed.xlsx` — an Excel `.xlsx` file with one sheet per entity (`users`, `craft`, `passes`, `commands`, `anomalies`, `telemetry`, `audit_seed`; each row a record, columns its fields) plus a `Constants` sheet of scalar `key`/`value` rows (`password_for_all_accounts`, `high_energy_delta_v_ms`, `battery_reserve_pct`); the `users` sheet's `assigned_craft` column is a JSON array like `["SAT-ALPHA"]`. Parse it with the xlsx parser already available in the environment and load every record into SQLite on first creation. It must start with `node /app/server.js`, listen on port `3000`, expose a successful `GET /api/health` before any database work blocks startup, serve the browser UI from `/app/public/index.html`, and store durable data in `/app/orbitalops.db`. The required dependencies are already available; the running app must not install packages or require external network assets.

Provide these demo accounts with password `password123`:

- `mara.okoye@orbitalops.test` — Operator
- `iris.vance@orbitalops.test` and `sofia.reyes@orbitalops.test` — Flight directors
- `tomas.lind@orbitalops.test` — Analyst, assigned to SAT-ALPHA only
- `root@orbitalops.test` — Administrator
