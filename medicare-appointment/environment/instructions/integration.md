# Integration Policy

## SQLite

SQLite is embedded in the application and requires no external service.

- Keep the database on a persistent path inside the container.
- Create the directory, schema, and seed rows at startup, and make starting up
  safe to repeat.
- The database is the system of record. Browser storage may remember which demo
  user is selected, and nothing else.

## Stripe Checkout

Stripe is the only third-party application integration.

- Use the official Stripe server SDK, and create hosted Checkout Sessions on
  the server.
- The browser has to end up on Stripe's own Checkout page
  (`checkout.stripe.com`) and return to the app afterwards.
- Stripe is the authority on what has been paid for.
- Use test credentials only, with the Stripe test card `4242 4242 4242 4242`.

## Scope

One self-contained application container plus Stripe's public API. Do not use
Supabase, PostgreSQL, or other external databases.

## Environment

Required variables are `STRIPE_SECRET_KEY`, `PORT`, and `BASE_URL`.
`STRIPE_PUBLISHABLE_KEY` may be present but is not required for redirecting to
server-created hosted Checkout. Secret values must never reach browser code or
logs.
