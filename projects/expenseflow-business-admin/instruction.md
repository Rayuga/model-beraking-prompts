# ExpenseFlow travel & expense back office

can you build me a polished full-stack travel & expense (T&E) reimbursement back office for a multinational employer? I need a real backend server and persistent storage, not just a static dashboard. Include demo login accounts and show the signed-in person's role.

Let me move between Dashboard, Reports, Cost Centers, and Audit. As a submitter-proxy I should be able to file and edit expense reports on an employee's behalf. As finance I should be able to adjudicate a filed report (convert each foreign line, disallow what breaches policy, prorate the meals per-diem, and accrue reclaimable tax), post the approved cost-center split, and reject a bad receipt to claw the money back. As an approver I should be able to approve a report at my amount tier. Everyone should be able to read the append-only audit trail. Keep dashboard metrics and each screen's figures visibly computed, not just stored, and preserve every change across page reloads and new sign-in sessions.

The exact FX table, policy caps, per-diem, reclaimable-tax, approval-tier, cost-center-split, and clawback rules are written up in `/assets/artifacts/expenseflow_rules.md` — read that file and follow it precisely. The numbers there are authoritative and override anything a request body or the UI might suggest.

Put the application in `/app`. Build the backend with Node.js and Express, use SQLite for durable storage, and use the provided seed data at `/assets/artifacts/expenseflow_seed.json`. It must start with `node /app/server.js`, listen on port `3000`, expose a successful `GET /api/health` endpoint before any database work blocks startup, serve the browser UI from `/app/public/index.html`, and store durable data in `/app/expenseflow.db`. The required server dependencies are already available in the environment; the running app must not install packages or require external network assets.

Provide these demo accounts with password `ExpenseFlow!2026`:

- `dana.ortiz@expenseflow.example` — Submitter-proxy
- `ken.iyer@expenseflow.example` — Approver (manager tier)
- `ravi.anand@expenseflow.example` — Approver (director tier)
- `mona.feldt@expenseflow.example` — Approver (controller tier)
- `lena.poole@expenseflow.example` — Finance
- `sam.ndlovu@expenseflow.example` — Auditor
