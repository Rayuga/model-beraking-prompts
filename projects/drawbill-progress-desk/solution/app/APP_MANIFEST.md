# DrawBill

## Install

```bash install
npm ci --omit=dev --offline --cache /opt/npm-offline
```

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}` (`node --experimental-sqlite src/index.js`).

`GET /health` returns `{"ok": true, "ledger": "sqlite", "ledger_file": "/app/data/drawbill.db"}`.
`GET /APP_MANIFEST.md` serves this file.

## Persistence

- Engine: SQLite via `node:sqlite`
- File: `data/drawbill.db`
- Schema + seed run automatically and idempotently on startup. Seed JSON is
  loaded from `/app/artifacts` first, then `SEED_DIR`, then `/assets/artifacts`.
- Inclusive days and calendar-day parsing use Luxon (UTC). Cent math is
  integer pennies. Vendor desks compose tax, retainage, fee, bond, fringe,
  and damages.

## Demo identity

No login is required. A fresh browser starts as **Avery Lin**.

Header control: **Switch demo user**

The browser sends `X-Demo-User-Id`. The server validates the ID and enforces
role + company scope on every protected ledger query. Unknown or tampered
ids are rejected outright — they never fall back to a default user or role.

Seeded owner APs: Victor Hale (Harborview) and Owen Park (Pier Canopy).

## Endpoints

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/health` | Health check |
| GET | `/api/session` | Active demo user |
| GET | `/api/demo-users` | Switcher options |
| GET | `/api/jobs` | Visible jobs |
| GET | `/api/jobs/:id` | SOV + papers |
| POST | `/api/applications` | File a derived paper |
| POST | `/api/applications/:id/withdraw` | Void an uncertified pencil |
| POST | `/api/applications/:id/submit` | Pencil → submitted |
| POST | `/api/applications/:id/certify` | Architect exact net |
| POST | `/api/applications/:id/release` | Owner AP to rail |
| POST | `/api/applications/:id/checkout` | Open a card-desk session |
| POST | `/api/applications/confirm` | Ask the card desk, then post |
| POST | `/api/applications/:id/notary` | Unconditional waiver |
| GET | `/api/quote` | Live composed net before the card |
| GET | `/api/tickets` | Quantity and receiving tickets |
| GET | `/api/change-orders` | Executed and draft extras |
| GET | `/api/sub-invoices` | Subcontractor invoices |
| GET | `/api/payroll` `/api/insurance` `/api/inspections` | Plant stamps |
| GET | `/api/notices` `/api/sms` `/api/emails` | Paid copies |
| GET | `/api/waivers` `/api/punches` `/api/diary` `/api/audit` | After pay |

## The card desk

The plant's card desk on `VENDOR_BASE_URL` (default `http://localhost:3101`)
opens the card session and is asked afterwards whether it was paid; the app
never sees card details and never trusts the return trip. Reached with
`VENDOR_TOKEN`. Test card: `4242 4242 4242 4242`.
