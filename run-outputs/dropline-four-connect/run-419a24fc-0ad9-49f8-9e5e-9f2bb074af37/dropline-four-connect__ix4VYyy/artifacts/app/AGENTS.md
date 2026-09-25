# DropLine repository memory

- Backend: Express + better-sqlite3 in `/app/server.js`
- Database path: `/app/dropline.db`
- Seed workbook: `/assets/artifacts/dropline_seed.xlsx`
- Seeded demo accounts: Avery Morgan and Jordan Lee, both with password `password123`
- Competitive and practice state are separated in SQLite.
- Bearer tokens are stored as active session hashes in SQLite and revoked with `/api/auth/logout-all`.
- Analysis routes are documented in `APP_MANIFEST.md`.
- Use the browser app from `/app/public/index.html` with `/app/public/app.js` and `/app/public/styles.css`.
