# TorqueBay Enterprise manifest

```bash start
npm start
```

The Express server listens on `0.0.0.0:${PORT:-3000}` and serves the built React app from `public/`. `GET /health` is the readiness route. Application endpoints live under `/api` in these families: `/api/session` and `/api/demo-users`, `/api/dashboard`, `/api/customers`, `/api/vehicles`, `/api/repair-orders`, `/api/estimates`, `/api/bays`, `/api/technicians`, `/api/labor-logs`, `/api/parts`, `/api/shipments`, `/api/warranty-claims`, `/api/invoices`, `/api/job-documents`, `/api/appointment-requests`, and `/api/audit`.

The active demo identity is sent as `X-Demo-User-Id`. A missing header resolves to seeded service advisor Nora Adler; unknown IDs are rejected. The visible user switcher changes that header and never grants a role supplied in a body, query, or alternate header.

The canonical app-root seed files are `customers_seed_data.json`, `shop_floor_seed_data.json`, and `staff_seed_data.json`; `/assets` is a build-time input and is not needed at runtime. A fresh database initializes from the equivalent seed facts bundled with the application. The durable SQLite database lives at `DB_PATH`, or `/app/torquebay.db` when the variable is absent. Browser storage may remember only the selected demo identity.
