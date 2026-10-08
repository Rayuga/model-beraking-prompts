# How we run it

We start the app with Node 22 running `/app/server.js` as an ordinary user and not necessarily from inside `/app`, so find your own files relative to `server.js` rather than the folder it was started from. It should listen on 0.0.0.0 port 3000. Express and better-sqlite3 are already installed globally and found through `NODE_PATH`. Keep everything in SQLite at `/app/app.db`, or at the path in `DB_PATH` when that is set. `GET /api/health` should answer 200 even if the database can't be opened, so we can tell the server itself is up. The pages may load external fonts, scripts or CDN assets if you want them, but matter data stays in our own server and database.

Copy `/assets/seed_data.json` into `/app` and import it once into an empty database. After that, restarts keep everything as it was: messages, replies, edits and their versions, timers, holds, walls, unread positions and deletions, without importing again. Please hand it over without a database left from your own trying-out, so the first start imports the starting data fresh, and don't put symbolic links anywhere in `/app`; we won't run an app that has them.

The firm runs on a fixed clock, 2026-05-12T11:00:00Z. New messages, edits and transcripts carry that time, and timers are measured against it. That means everything sent today has the same time, which is why we care that the order stays consistent.

Anyone who isn't signed in gets no matter, message, mention or transcript data from the server.
