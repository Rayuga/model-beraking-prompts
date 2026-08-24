# MedCare Appointments

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

`GET /health` returns `{"ok": true}`.

## Persistence

- Engine: SQLite via Node built-in `node:sqlite`
- Path: `/app/data/medcare.db`
- Schema + seed run automatically and idempotently on startup
- Deleting `data/*.db*` and restarting recreates a clean seeded database

## Demo identity

No login is required. A fresh browser starts as **Alice Johnson**.

Header control: **Switch demo user**

Seeded identities:

| Name | Role |
|------|------|
| Alice Johnson | patient (default) |
| Bob Williams | patient |
| Carol Davis | patient |
| Dr. Sarah Chen | doctor · Cardiology · $150 |
| Dr. James Mitchell | doctor · Dermatology · $120 |
| Dr. Priya Sharma | doctor · Pediatrics · $100 |

The browser sends `X-Demo-User-Id`. The server validates the ID and enforces
role + ownership on every protected SQLite query. Unknown or tampered ids are
rejected outright — they never fall back to a default user or role.

## Availability enforcement

Each doctor's `availability` string (e.g. `Mon-Fri 9AM-5PM`) is parsed and
enforced server-side on every booking attempt, not just displayed. Day
ranges and hour ranges are both inclusive on both ends (a booking starting
exactly at the listed start or end time is bookable). This is checked in
addition to future-dating and per-doctor slot uniqueness, and is evaluated
independently of them.

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Health check |
| GET | `/api/session` | Active demo user |
| GET | `/api/demo-users` | Switcher options |
| GET | `/api/doctors` | Public doctor directory |
| GET | `/api/doctors/:id` | Doctor profile |
| POST | `/api/appointments` | Patient creates Stripe Checkout |
| POST | `/api/appointments/confirm` | Patient verifies Stripe + writes appointment |
| GET | `/api/appointments` | Scoped to active patient or doctor |
| PATCH | `/api/appointments/:id` | Assigned doctor marks completed |
| GET | `/api/medical-records` | Scoped records |
| POST | `/api/medical-records` | Assigned doctor adds notes |

## Stripe

Requires `STRIPE_SECRET_KEY`.

Flow:

1. Server reads consultation fee from SQLite
2. Creates Stripe-hosted Checkout Session
3. On return, retrieves Session and verifies `paid`, amount, patient ownership
4. Inserts at most one confirmed appointment per Session ID

Test card: `4242 4242 4242 4242`

## Scope

Local SQLite + Stripe only. No external database and no notification service.
