# GearVault

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

`GET /health` returns `{"ok": true, "ledger": "postgres"}`.

## Persistence

- Engine: PostgreSQL via `postgres` (postgres.js)
- URL: `DATABASE_URL` (default `postgres://gearvault:gearvault@127.0.0.1:5432/gearvault`)
- Schema + seed run automatically and idempotently on startup
- Inclusive days and calendar-day parsing use Luxon (UTC). Request dates
  are Zod-checked as `YYYY-MM-DD` only. Cent math uses decimal.js.

## Demo identity

No login is required. A fresh browser starts as **Maya Chen**.

Header control: **Switch demo user**

Seeded identities:

| Name | Role |
|------|------|
| Maya Chen | customer (default) · current Drone Operator cert |
| Jordan Hale | customer · expired Drone Operator cert |
| Priya Nair | customer · ON_HOLD |
| Chris Nguyen | customer · no history |
| Tess Okada | customer · walk-in |
| Luis Ferreira | customer · walk-in |
| Sam Ortiz | rental associate |
| Dana Ruiz | rental associate |
| Riley Okonkwo | damage assessor |
| Jules Adeyemi | damage assessor |
| Elena Voss | shop manager |
| Noah Kim | transfer clerk |
| Omar Haddad | bay technician |
| Harper Singh | night auditor |
| Wei Tan | insurance liaison |
| Casey Bloom | lot runner |

The browser sends `X-Demo-User-Id`. The server validates the ID and enforces
role + ownership on every protected ledger query. Unknown or tampered ids are
rejected outright — they never fall back to a default user or role.

## Calendar and money

Date ranges are inclusive on both ends. A Friday-to-Sunday rental is three
billable days, and a same-afternoon in-and-out is one. Overlap is keyed per
serialized unit. No single booking may run longer than 14 inclusive days. A
Stripe Checkout Session is a quote and does not hold the calendar; one paid
session writes at most one reservation, and nothing is posted to any vendor
desk until Stripe reports the session paid.

The Stripe total is composed in this order, in `src/pricing.js` and
`src/vendors.js`:

1. Kit line at full price = daily rate × inclusive days.
2. Week rate: from the 7th day of one paper, a tenth comes off the whole kit
   line. Six days is full price. The tenth never touches the deposit or the
   hull rider.
3. Weekend desk: one surcharge line per Saturday and per Sunday on the paper.
4. County tax desk: charged on (discounted kit line + weekend lines). The
   deposit and the hull rider are deliberately excluded from the taxed base.
   Riverside, Downtown and Pier are three separate windows.
5. Insurance bureau: drone hull cover, billed per day; the bureau is sent the
   day count and refuses to quote without it.
6. Deposit, untaxed and undiscounted.

After pay the notice, SMS and email desks, the shop diary, and — for members
only — the loyalty desk are updated with those same figures; drone hull binds
carry HMAC-SHA256 of `sessionId:premium_cents`. Check-out spends a live bay
serial scan, which requires the fleet desk's bay code first. A returned kit is
`RETURNED_PENDING_INSPECTION` and is neither bookable nor transferable until
the inspection is decided. A damage report Riley records as major sends the
unit to `IN_REPAIR` when the manager approves it; anything else returns it to
the floor. Holiday closures come from the blackout desk. Van moves spend a
transfer-bureau stamp, are a transfer-clerk job, and only move units that are
`AVAILABLE`.

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Health check |
| GET | `/api/session` | Active demo user |
| GET | `/api/demo-users` | Switcher options |
| GET | `/api/units` | Catalog |
| GET | `/api/units/:id` | Unit profile |
| GET | `/api/quote` | Live quote: kit line, week rate, weekend, tax, hull, deposit |
| GET | `/api/audit` | Ledger audit trail (manager / night auditor) |
| POST | `/api/units/:id/repair` | Manager sends a unit to the bay |
| POST | `/api/units/:id/restore` | Manager returns a unit to the floor |
| POST | `/api/units/:id/retire` | Manager retires a unit |
| POST | `/api/units/:id/rate` | Manager changes the wall-card daily rate |
| POST | `/api/customers/:id/hold` | Manager places a customer on hold |
| POST | `/api/customers/:id/release-hold` | Manager releases a hold |
| POST | `/api/reservations/:id/cancel` | Customer cancels their own unstarted booking |
| GET | `/api/notices` | Notice-desk copies for the active identity |
| GET | `/api/sms` | SMS-desk copies for the active identity |
| GET | `/api/emails` | Email-desk copies for the active identity |
| GET | `/api/loyalty` | Loyalty punches for the active identity |
| GET | `/api/hull-binds` | Insurance-bureau hull binds |
| POST | `/api/hull-binds` | Proxy a signed hull bind to the bureau |
| GET | `/api/calendar-holds` | Shop-diary holds |
| GET | `/api/reservations/:id/calendar.ics` | Paid paper as an iCalendar file |
| GET | `/api/reservations/:id/hire-waiver.pdf` | Seed hire-waiver PDF for that paper |
| POST | `/api/reservations/:id/scan-ticket` | Associate obtains a bay serial scan |
| POST | `/api/reservations/:id/media-ticket` | Assessor obtains a photo-desk ticket |
| POST | `/api/units/:id/transfer-stamp` | Transfer clerk obtains a bureau stamp |
| POST | `/api/units/:id/transfer` | Transfer clerk moves a kit after a stamp |
| POST | `/api/reservations` | Customer creates Stripe Checkout |
| POST | `/api/reservations/confirm` | Customer verifies Stripe + writes reservation |
| GET | `/api/reservations` | Scoped to customer; staff see all |
| POST | `/api/reservations/:id/checkout` | Associate hands kit over |
| POST | `/api/reservations/:id/return` | Associate receives return |
| POST | `/api/reservations/:id/inspect-clear` | Assessor: no damage |
| POST | `/api/reservations/:id/damage` | Assessor files report |
| POST | `/api/damage-reports/:id/approve` | Manager, not the filer |
| POST | `/api/damage-reports/:id/deny` | Manager, not the filer |

## Stripe

Requires `STRIPE_SECRET_KEY`.

Flow:

1. Server reads daily rate and deposit from the shop Postgres
2. Applies the week rate, asks the weather / blackout / weekend / tax / hull desks in that order, then creates Stripe-hosted Checkout for the discounted kit line + weekend + tax + optional hull + deposit
3. On return, retrieves Session and verifies `paid`, amount, customer ownership
4. Inserts at most one confirmed reservation per Session ID

Test card: `4242 4242 4242 4242`

## Scope

Shop Postgres + Stripe + shop-network vendor desks on `VENDOR_BASE_URL`.
