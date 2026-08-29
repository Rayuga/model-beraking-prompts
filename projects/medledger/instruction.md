# Task: MedLedger — health-system back-office platform

Build a full-stack web app called **MedLedger**. A health system runs its back
office on it: the clinic registers patients and writes orders, the pharmacy
dispenses, the lab runs bloods, radiology reads studies, medical transport moves
patients, central supply keeps the stockroom, billing files claims, and
compliance keeps credentials and the general ledger where every department's
money has to reconcile.

## Deliverable format (required — read before you choose a stack)

Build this as a **Node app** and write it to `/app`. The grader only boots a Node
submission, so it must satisfy this contract exactly:

- `/app/package.json` exists and `npm install` succeeds.
- `npm start` launches the server and serves the app (the reference build runs
  `node --experimental-sqlite server/index.js` — Express serving a bundled
  front-end, with SQLite persistence).

Node 22 is installed with **Express, React, React-Router, Vite, Tailwind and
lucide-react already available** — use them. Do **not** build a Python/Flask (or
any non-Node) app: a submission without a working `/app/package.json` never boots
and scores **0**, regardless of how complete it is.

## Read these first

The brief is already in this container under `/instructions/`, split across
`overview.md`, `behaviour.md`, and `security.md`. **Read all of them before you
write anything.** They are one document split by topic and none of it is optional.

`behaviour.md` is the floor talking about how work actually goes — not a checklist
and not an API guide. The requirements are in there; they are just told as stories,
scattered across the departments that tripped over them.

`/assets/CREDENTIALS.md` covers Stripe, DocuSeal and env vars.
`/assets/artifacts/roster_seed_data.json` is the health system's seed data — every
record and every staff sign-in, each with its stable id. Seed your database from it
exactly; do not invent parallel ids.

Nothing in the product should need a route or an element id explained before it
can be used.
