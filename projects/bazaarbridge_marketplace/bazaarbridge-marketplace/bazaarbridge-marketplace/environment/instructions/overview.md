# BazaarBridge — overview

Build a full-stack web app called **BazaarBridge**, a practical multi-vendor
marketplace operations tool. The team should be able to sign in, see live
figures, move orders forward, adjust stock and progress payouts, with every
change surviving a reload.

## Roles

Provide demo sign-ins for all three seeded accounts, each with the password
`password123`. After signing in, the app must visibly identify who is signed in
and which role they hold — Administrator, Operations lead, or Finance manager.
They do not all have the same authority; `security.md` sets out who may change
what.

## Workspaces

After signing in, the user must be able to move between four workspaces:

- **Dashboard** — live headline figures and recent activity
- **Orders** — search, status filtering, and status changes
- **Inventory** — stock levels and low-stock visibility
- **Payouts** — payout status changes, ready-payout impact, and the per-merchant
  settlement statements described in `policy.md`

Populate these areas from `/assets/artifacts/bazaarbridge_seed_data.json` on
first boot. Seeding must be idempotent: booting again must not duplicate rows
or wipe successful user changes.

Everything seeded there must exist in the running app and be reachable by the
Administrator.
