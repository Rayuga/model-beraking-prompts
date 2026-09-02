# DropLine repo notes

- Start the app with `node /app/server.js` on port `3000`.
- Durable data lives in `/app/dropline.db`.
- Seed workbook: `/assets/artifacts/dropline_seed.xlsx`.
- Seed demo accounts:
  - `avery@dropline.test` / `password123` / Avery Morgan
  - `jordan@dropline.test` / `password123` / Jordan Lee
- Server stack: Express + better-sqlite3 + xlsx.
- Auth uses bearer tokens stored in SQLite `sessions`.
- Per-account state is stored in `games` with JSON columns for board, history, and redo.
- Verified draw sequence for tests: repeat `[1,4,2,5,3,7,6]` six times.
