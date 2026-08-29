# Trust

## Data

- SQLite is the record of truth.
- Tell users enough to understand what went wrong; don't leak internals in error
  messages.
- Authorization has to hold when someone bypasses the UI — not only when the
  button is hidden. A clerk reaching past their site, or an id nobody seeded, gets
  nothing at all, certainly not the administrator's view by default. The role that
  matters is the one on the sign-in, never one a request tries to name for itself.
