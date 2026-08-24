# Task: GearVault — a multi-location equipment rental counter

Build a small full-stack web app called **GearVault**. Three shop
locations — Riverside, Downtown, and Harbour Pier — share one catalog of
eighteen serialized units. Customers reserve cameras, lenses, drones,
outdoor canvas, and event kit through Stripe Checkout; the shop checks
the gear out and back in, and writes up damage against the deposit when
something comes home wrong.

**Read `/assets/instruction.md` before you write anything.** That file is
the whole brief. It is the shop talking, not a specification and not a
checklist. There is no second `/instructions/` tree.

`/assets/CREDENTIALS.md` covers Stripe, the shop Postgres, and the
shop-network vendor desks. `/assets/artifacts/` holds the seed JSON, the
riverside river mark, and the hire waiver PDF. Artifact money is whole
dollars; the desks and the ledger work in pennies.

Nothing in the product should need a route or an element id explained
before it can be used.
