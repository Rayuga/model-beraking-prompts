# Security and access

Nobody may see marketplace data before signing in. A wrong password leaves the
browser signed out; the right password lands that person on their own populated
work. Signing out ends the session, and a signed-out caller must not read or
write operational data.

The Administrator oversees everything and can suspend or demote people and create products.
Demotion may assign the view-only Viewer role, which can read the person's permitted desks but grants no write authority over orders, stock, payouts, refunds or merchant settings; restoring the previous role restores that authority.
The Operations lead changes orders and stock. The Warehouse lead records receipts and drives shipments.
The Finance manager requests payouts and refunds; the Finance checker approves and releases them and is the only Finance role whose control can reveal a full merchant bank token.
The Compliance officer freezes and unfreezes merchants and reviews the audit trail. Merchant accounts read only their own merchant's records; they cannot change orders, stock, payouts or merchant settings.

Whoever a write belongs to is decided by the signed-in person and the stored records, never by fields a request carries.
A hidden or missing control is not enforcement. Durable changes must still be there after a fresh sign-in.
