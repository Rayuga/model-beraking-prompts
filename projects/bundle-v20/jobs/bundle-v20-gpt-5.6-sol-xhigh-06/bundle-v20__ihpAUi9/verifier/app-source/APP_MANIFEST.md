# GearVault

```bash start
npm start
```

## Demo identity

A fresh browser selects Maya Chen. The clearly labelled **Using GearVault as** switcher lists all seeded customers and staff. The browser stores only that selected seeded person's UUID; every API request sends it in `X-Demo-User`, and the server resolves the person and role from Postgres. Unknown or missing identities are rejected. Request bodies, query strings, and role headers cannot change identity or permissions.

## Main HTTP endpoints

- `GET /` — responsive application UI
- `GET /api/overview` — active identity, catalog and locations
- `POST /api/quotes` — live desk-backed rental quote
- `POST /api/checkout` — create Stripe-hosted Checkout session
- `POST /api/payments/confirm` — verify a paid Stripe session and hold dates
- `GET /api/me/records` — active customer's private rentals and vendor records
- `GET /api/operations` — role-filtered staff workspace data
- `POST /api/reservations/:id/{scan,checkout,return,inspect,cancel}` — rental lifecycle actions
- `POST /api/inspections/:id/approve` — manager damage decision
- `POST /api/units/:id/{transfer,manage}` — stamped transfer and manager fleet actions
- `GET /api/reservations/:id/calendar.ics` — private hire calendar download
- `GET /downloads/hire-waiver.pdf` — supplied hire waiver
- `GET /api/health` — app, Postgres and vendor-network status

All state-changing API requests require an `Idempotency-Key`; receipts are scoped to the active person and persisted in Postgres.

## Shop Postgres

The server reads `DATABASE_URL` (default `postgres://gearvault:gearvault@127.0.0.1:5432/gearvault`) and uses it as the sole ledger. Startup creates the schema and idempotently seeds the supplied artifact JSON. Money is converted from whole seed dollars to integer pennies. Reservations, immutable paid totals, unit state/location, inspections, deposit decisions, idempotency receipts and audit entries persist there across restarts.
