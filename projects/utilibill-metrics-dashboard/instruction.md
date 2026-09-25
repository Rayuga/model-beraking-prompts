# UtiliBill billing and settlement dashboard

can you build me a polished full-stack billing and regulatory-settlement back office for our energy retail desk? I need a real backend and persistent storage. Include our five demo logins and show the signed-in person's name and role.

Let me move between Dashboard, Accounts, Settlement, and Audit. As the billing operator I need to bill metered cycles, run annual budget true-ups, and finalize billed cycles into a settlement period. As the meter-data analyst I need to review our stored reads and raise a correction when a later actual read replaces an estimate or corrects a previous re-bill. As either settlement controller I need to approve large corrections and release remittances. Our rate administrator should be able to review the supplied tariffs and the already-active rate change throughout the applicable billing details; I don't need a rate editor.

Show how each figure was calculated: energy, each rider, export credit, the credit bank, deferred balances, correction amounts and remittances. Keep historical bills and audit entries intact. Every successful change must survive a reload, a fresh sign-in and a server restart. Hide protected information when signed out, and enforce each role's permissions on the server.

Give the desk a clear visual hierarchy, readable figures and consistent styling in light and dark modes. It should work on a phone as well as a desktop, with labelled controls, keyboard access, visible focus, comfortable touch targets and respect for reduced motion. Opening account details and completing or refusing an action should give clear, current feedback; avoid duplicate submissions while a request is pending.

The exact contract is in `/assets/artifacts/utilibill_rules.md`, and the starting roster is `/assets/artifacts/utilibill_seed.json`. Follow those supplied terms, including their rounding and reference date. These are our fictional contract rates. Keep the supplied record IDs and copy any needed reference data into your application during the build.

Put the app in `/app`, using Node.js, Express and SQLite. It must start from `/app` with `node /app/server.js`, listen on port `3000`, serve the UI from `/app/public/index.html`, and return a successful `GET /api/health` when ready. Store durable records in `/app/utilibill.db`, honouring `DB_PATH` if provided. The runtime receives the `/app` artifact; `/assets` and `/instructions` are build-time inputs and may be absent at startup. Express and better-sqlite3 are already installed. Public networking is available. Add `/app/APP_MANIFEST.md` with the startup command, database location and a short guide to the workspaces.

Every demo account uses password `Utilibill!2026`:

- `anaya.rao@utilibill.example` — Anaya Rao, meter-data analyst
- `owen.price@utilibill.example` — Owen Price, billing operator
- `rhea.tan@utilibill.example` — Rhea Tan, rate administrator
- `cira.lund@utilibill.example` — Cira Lund, settlement controller
- `cyrus.okafor@utilibill.example` — Cyrus Okafor, settlement controller
