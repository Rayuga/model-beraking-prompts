# Security and access

Nobody sees marketplace records before signing in. A wrong password leaves the browser signed out; the right password opens that person's own populated work. Signing out ends access, and replaying a protected read or write after sign-out neither returns protected records nor changes anything.

Ari, the Administrator, oversees people and products. Owen, the Operations lead, changes orders and stock. Wren, the Warehouse lead, records receipts and drives shipments. Faye, the Finance manager, requests payouts and refunds. Cal, the Finance checker, approves and releases them and is the only finance role whose control can reveal a full bank token. Mona, the Compliance officer, freezes and unfreezes merchants and reviews the audit trail.

Merchant accounts read only their own merchant's records and cannot change orders, stock, payouts or merchant settings. A demoted person may become a Viewer, who can read the desks they are allowed but cannot change orders, stock, payouts, refunds or merchant settings; restoring the earlier role restores that person's write power.

Suspension and demotion take effect on the very next write. Writes belong to the signed-in person and stored records, never to fields a request carries. Hiding a control is not enforcement, so the server refuses the write itself.

A request may carry fields the app does not use. The server ignores every field it does not own or derive and never rejects a request only because extra fields are present; stored and derived values decide the outcome. Platform staff see the Admin desk read-only, and administrative writes belong to the Administrator alone and are refused for every other role.
