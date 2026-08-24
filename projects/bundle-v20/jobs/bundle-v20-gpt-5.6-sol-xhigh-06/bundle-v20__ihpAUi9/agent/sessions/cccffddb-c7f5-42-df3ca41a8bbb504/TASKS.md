# Task List

1. ✅ Create Node app, Postgres schema, idempotent seed, identity and authorization foundation
Express/Postgres app starts, creates schema safely, seeds 6 customers/10 staff/3 locations/18 units/2 certifications, requires known identity and per-user mutation tickets.
2. ✅ Implement live quote, availability, Stripe Checkout, payment finalization and customer records
Live desk-backed quote, inclusive date rules, week discount/tax/hull/weekend logic, Stripe hosted session and paid-only records/copies implemented.
3. ✅ Implement checkout, return, inspection, damage approval, repair, transfer and audit workflows
Role-guarded scan, checkout, return, inspection, manager, transfer, standing, card management and audit APIs implemented.
4. ✅ Build responsive role-aware UI with discoverable customer and staff workflows
Responsive branded customer catalog/records and role-specific staff workspaces built; supplied Riverside mark and downloadable waiver included.
5. ✅ Run integration tests, browser/API smoke checks, restart persistence check and finalize manifest
Syntax and clean startup pass; 18-unit penny seed verified; live 7-day quote math verified; strict dates, max span, hold/cert/role/identity denials pass; idempotent replay persists across restart; static SVG/PDF and staff/customer APIs pass. Clean server running on port 3000.
