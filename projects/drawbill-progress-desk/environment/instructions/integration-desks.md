# Plant-network vendor desks

The till is not allowed to invent county tax, warehouse tax, retainage, fee,
bond, fringe, weather, liquidated damages, blackout, stored conversion,
change-order status, mill index, tickets, permits, payroll, COI, architect
stamps, encumbrance, joint-check payees, DBE, sub-invoices, paid copies,
texts, diary holds, or punches. Those desks already run on the plant
network. How to reach them is in `/assets/CREDENTIALS.md`.

The desks are up whenever the container is. They are answering while the
product is being built, not only while it is being demonstrated, so ask them
what they accept and try a composition against them rather than shipping an
integration nobody has run.

The plant keeps a ledger of who asked it what. `GET /audit/calls` on the
desks' own origin returns the desks that have been called; it is read-only,
takes no token, and is there so the till can check its own work.
