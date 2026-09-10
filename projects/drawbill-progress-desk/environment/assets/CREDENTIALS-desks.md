# Plant-network vendor desks

The desks listen on `VENDOR_BASE_URL` (default `http://localhost:3101`) for
as long as the container is up — while the product is being built as well as
while it is being demonstrated. The till is not supposed to invent the
numbers those desks already know.

What lives out there, in the plant's own words: county tax (Riverside,
Downtown, and Pier are not the same window), warehouse tax, retainage, GC
fee, bond, fringe rider, weather, liquidated damages, fiscal blackout,
stored materials, change-order registry, steel index, quantity tickets,
permit / inspection, certified payroll, insurance COI, architect e-stamp,
owner encumbrance, joint-check payees, DBE participation, sub-invoices,
notice / SMS / email copies, pay-period diary, preferred-vendor punch, lien
waivers, and the card desk that takes the card itself.

How the desks expect to be greeted: `VENDOR_BASE_URL`, `VENDOR_TOKEN`
(`db-vendor-dev`) as `Authorization: Bearer …`, and `NOTICE_API_KEY`
(`db-notice-dev`) as `X-Notice-Key` for the copy desks.
