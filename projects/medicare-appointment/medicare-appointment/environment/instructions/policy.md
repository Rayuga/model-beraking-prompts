# Coding policy

## Tech stack

- One Node.js process serving the web UI and API on port **3000**, listening
  on `0.0.0.0`.
- Local SQLite as the system of record (no Supabase, PostgreSQL, other
  external databases, or browser storage as the source of truth).
- Official Stripe server SDK and Stripe-hosted Checkout.

## Dependencies

`express` and `stripe` are available under `/opt/medcare-deps/node_modules` if
you want to reuse them; otherwise install what you need into `/app`. The
container has outbound network access. `package.json` must expose a working
`"start"` script.

## Demo identity

- A fresh browser defaults to Alice Johnson.
- A clearly labeled user switcher changes the active seeded identity.
- Document how identity works in `APP_MANIFEST.md`.

## Deliverables

### `APP_MANIFEST.md`

Place this at the project root next to `package.json`. Include:

1. A fenced start command tagged `bash start`.
2. How demo identity works.
3. The main HTTP endpoints you chose.
4. Where the SQLite file lives.

Example:

```bash start
npm start
```

## Environment safety

- Never run `pkill -f node` or `killall node` — they can kill the agent
  session. Stop only the server PID you started.
- Read Stripe credentials from the environment. Never expose secret keys to
  the browser.
