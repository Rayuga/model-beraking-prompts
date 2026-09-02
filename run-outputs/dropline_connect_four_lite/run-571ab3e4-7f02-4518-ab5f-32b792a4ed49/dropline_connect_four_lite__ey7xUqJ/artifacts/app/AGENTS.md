# DropLine project memory

- Start the app with `node /app/server.js` on port 3000.
- Durable data lives in `/app/dropline.db`.
- Seed accounts and initial state come from `/assets/artifacts/dropline_seed.xlsx`.
- The backend uses Express + better-sqlite3; the browser UI is vanilla HTML/CSS/JS.
- Bearer tokens are stored in SQLite and checked on every authenticated API request.
- Current game history is server-backed; undo/redo operate on persisted move rows.
- Keep changes account-scoped; each account has its own board and totals.
