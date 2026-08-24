# Environment Variables

The shop ledger is Postgres. A local file is not the books.

## Stripe test mode

`STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are required for Checkout.

**Temporary packaging note:** until the Harbor portal injects these as job
secrets (the same way it supplies `OPENROUTER_API_KEY`), the task zip embeds
Stripe **test-mode** keys in `task.toml` `[environment.env]` and
`[verifier.env]` so oracle/model runs can launch. Prefer `${STRIPE_*}`
platform injection once secrets are available; do not use live keys.

- `STRIPE_SECRET_KEY` — Stripe test secret key (server-side only)
- `STRIPE_PUBLISHABLE_KEY` — Stripe test publishable key (browser if needed)

Obtain test keys from the [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys).

## Shop Postgres

`DATABASE_URL` points at the shop cluster (default
`postgres://gearvault:gearvault@127.0.0.1:5432/gearvault`). The image
ships PostgreSQL. If the socket is down, start the local cluster the
image already has (`/opt/gearvault-postgres/start.sh` or
`pg_ctlcluster 16 main start`) before the app.

- `DATABASE_URL` — server-side only

## Shop-network vendor desks

During grading the desks listen on `VENDOR_BASE_URL` (default
`http://localhost:3101`). The container image starts Postgres and the vendor
desks in the background at boot (`/opt/gearvault-shop/entrypoint.sh`). If the
socket is down, start them explicitly:

```bash
/opt/gearvault-shop/wait-shop-network.sh
```

The till is not supposed to invent the numbers those desks already know.

What lives out there, in the shop's own words:

- the county tax office (Riverside, Downtown, and Pier are not the same window)
- the hull insurance bureau, which also keeps signed binds after a drone
  is actually paid
- the weekend surcharge desk
- the weather desk
- the holiday / blackout desk (the week the shops go dark; van idle on dark days)
- the notice desk (the paper copy of a paid ticket)
- the SMS desk (the text that is supposed to go out the same moment)
- the email desk (the email copy that is supposed to go out the same moment)
- the shop diary
- the photo desk (Riley's pictures)
- the fleet serial desk (bay code for each serialized tag before a scan)
- the bay serial-scan desk (nothing leaves without a live scan)
- the loyalty desk (member cards only — Maya gets a punch when Stripe clears)
- the transfer bureau (Noah is the only one they will stamp a move for)

How the desks expect to be greeted:

- `VENDOR_BASE_URL` — origin of the desks
- `VENDOR_TOKEN` — `Authorization: Bearer …` for the desks that take a
  shop-network token
- `NOTICE_API_KEY` — `X-Notice-Key` for the copy desks (paper notices,
  texts, photo tickets)
- `INSURANCE_HMAC_SECRET` — the bureau uses this when it signs a hull
  bind. A bind without that signature, or with a signature that is not
  the bureau's, is not a bind.

The desks answer for the seeded shops and categories. They have a health
surface. Do not hard-code a single tax percentage, a hull line on every
kit, a closed week, or a weekend number someone remembered. What a desk
answers is the desk's business; deciding which figure to hand a desk,
and what to do with the number that comes back, is the shop's.

## Application

- `PORT` — defaults to `3000`.
- `BASE_URL` — defaults to `http://localhost:3000`.
- `NODE_ENV` — runtime mode.

`OPENROUTER_API_KEY` is verifier-only (judge) and is supplied by the platform
via `${OPENROUTER_API_KEY}` — it is not placed in the agent environment.
