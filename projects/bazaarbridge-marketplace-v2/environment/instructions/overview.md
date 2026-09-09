# BazaarBridge — overview

Nine people work on the desk and all use password `password123`: Ari Morgan
(Administrator), Owen Rivera (Operations lead), Wren Silva (Warehouse lead),
Faye Chen (Finance manager), Cal Iverson (Finance checker), Mona Patel
(Compliance officer), and one merchant staff account each for Alba Home,
Brook Outdoor and Cinder Living.

The eight desks are Dashboard, Orders, Products, Inventory, Warehouse,
Finance, Compliance and Admin. Every desk must be reachable, show its own
heading and content, and be populated from the seed records on first boot.
Seeding must be idempotent: booting again must not duplicate rows or wipe
changes.

Merchant accounts see only their own merchant's records. Platform staff see
across merchants, but the field notes describe where someone got further than
they should have. Every durable change must survive a fresh sign-in.
