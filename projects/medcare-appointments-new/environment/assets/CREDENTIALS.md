# Environment Variables

The SQLite database is local and needs no credentials.

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

## Application

- `PORT` — defaults to `3000`.
- `BASE_URL` — defaults to `http://localhost:3000`.
- `NODE_ENV` — runtime mode.

`OPENROUTER_API_KEY` is verifier-only (judge) and is supplied by the platform
via `${OPENROUTER_API_KEY}` — it is not placed in the agent environment.
