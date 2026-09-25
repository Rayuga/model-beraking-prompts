# UtiliBill

Run `node /app/server.js` from `/app`. The app listens on port 3000 and reports readiness at `/api/health`.
SQLite defaults to `/app/utilibill.db`; `DB_PATH` selects an alternative file. The seed is embedded in `src/seed_data.json` and initializes an empty database once. No `/assets` directory is needed at runtime.

Sign in with a demo account from the brief. Dashboard shows totals and policy details. Accounts contains the per-account detail panels, bill and correction actions, banks and budget plans. Settlement contains the operator's cycle selection and the controller's remittance action. Audit retains business history. Each role sees only its permitted write controls.
