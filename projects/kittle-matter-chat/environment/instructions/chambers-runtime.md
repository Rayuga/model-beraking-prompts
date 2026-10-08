# Chambers runtime

Node 22 starts `/app/server.js`, which binds 0.0.0.0 on port 3000. Express and better-sqlite3 are installed globally and found through `NODE_PATH`. Use SQLite at `/app/app.db`, unless `DB_PATH` gives another path. `GET /api/health` must reply 200 even when the database cannot be opened.

Copy `/assets/kittle.json` into `/app` and import it once into an empty database; later starts keep every message, timer, hold and deletion, without importing again.

The firm runs on a fixed clock, 2026-05-12T11:00:00Z. New messages and transcripts carry that time, and timers are measured against it.

Signed-out requests receive no matter, message or transcript data.
