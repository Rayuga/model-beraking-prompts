# Desk index and call ledger

The desks answer for the seeded jobs and windows. They have a health
surface, and they publish an index of themselves at their own origin —
ask the desks what they accept rather than guessing at it, and do not
hard-code a tax percentage, a retainage rate, a fee, a bond, a fringe
rider, or a closed week someone remembered.

The plant also keeps a ledger of the calls it receives:

- `GET /audit/calls` — read-only, no token. Returns `{ total, by_path,
  paths, calls }` for every desk request the plant has taken. It is there
  so a till can confirm it actually asked, rather than discovering at the
  till that it remembered.

`GET /health` on the desks reports the plant itself. That is the *plant's*
health surface, not the product's — what the product exposes is its own
decision, and is described in the brief. What a desk answers is the
desk's business; deciding which figure to hand a desk, and what to do
with the number that comes back, is the till's.
