# AGENTS.md

- Start the app with `node /app/backend/server.js` after building with `npm run build`.
- SQLite lives at `/app/pellmoor.db` unless `DB_PATH` overrides it.
- Hiring rules from `/instructions/hiring-rules.md` win over other notes.
- Write routes are revision-aware and idempotent with actor-scoped operation ids.
- Keep candidate stage history append-only and derive funnel counts from history.
- Only the demo accounts from the hosting note are valid sign-ins.
