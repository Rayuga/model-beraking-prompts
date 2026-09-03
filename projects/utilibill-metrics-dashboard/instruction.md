# UtiliBill billing & regulatory-settlement back office

can you build me a polished full-stack billing and regulatory-settlement back office for our energy retail desk? I need a real backend server and persistent storage, not just a static dashboard. Include demo login accounts and show the signed-in person's role.

Let me move between Dashboard, Accounts, Settlement, and Audit. As the billing operator I should be able to bill a metered cycle (energy, riders, net-metering, grand total), run each budget account's annual true-up, and finalize billed cycles into a settlement period. As the meter-data analyst I should be able to raise a true-up when a later actual read corrects an earlier estimated or previously-corrected one. As a settlement controller I should be able to approve a re-bill whose correction is large enough to need dual control, and run the remittance for a period. The rate administrator's tariff and rate-change details should be visible everywhere they apply. Keep every derived figure (energy charge, riders, net-metering credit and bank, deferred balance, contra, remittance) visibly computed, not just stored, and preserve every change across page reloads, new sign-in sessions, and a server restart.

The exact tier bands, TOU rates, riders, net-metering, budget and catch-up rules are written up in `/assets/artifacts/utilibill_rules.md` — read that file and follow it precisely. The numbers there are authoritative and override anything a request body or the UI might suggest.

Put the application in `/app`. Build the backend with Node.js and Express, use SQLite for durable storage, and use the provided seed roster at `/assets/artifacts/utilibill_seed.json`. It must start with `node /app/server.js`, listen on port `3000`, expose a successful `GET /api/health` endpoint before any database work blocks startup, serve the browser UI from `/app/public/index.html`, and store durable data in a database file under `/app`. The required server dependencies are already available in the environment; the running app must not install packages or require external network assets.

Every demo account uses password `Utilibill!2026`:

- `anaya.rao@utilibill.example` — Meter-data analyst (validates reads, raises true-ups)
- `owen.price@utilibill.example` — Billing operator (bills cycles, budget true-ups, finalizes)
- `rhea.tan@utilibill.example` — Rate administrator (tariff, rate changes)
- `cira.lund@utilibill.example` — Settlement controller (approvals, remittance)
- `cyrus.okafor@utilibill.example` — Settlement controller (approvals, remittance)
