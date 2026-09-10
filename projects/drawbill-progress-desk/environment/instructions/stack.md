# stack — this part is not negotiable

- One **Node.js** process serving the web UI and API on port **3000**,
  listening on `0.0.0.0`. Express is fine. Vanilla front end is fine.
- **SQLite** at `/app/data/drawbill.db` via Node's built-in `node:sqlite`
  (`node --experimental-sqlite`). do not use `sqlite3` or `better-sqlite3`.
  data survives a restart; seeding does not run twice. no symlinks in `/app`.
- The plant's own **card desk**, on the vendor network with the others,
  takes the card on its own origin. no remote fonts, scripts or styles, and
  nothing off a CDN.
- The plant-network vendor desks in `/assets/CREDENTIALS.md` for tax,
  retainage, fee, bond, fringe, weather, damages, blackout, stored
  materials, change orders, notices, texts, diary, and punches.

copy `/assets/npm-pin/` into `/app` and `npm ci --omit=dev --offline
--cache /opt/npm-offline`. frozen set: express, luxon, zod, decimal.js,
ical-generator. install from that cache and add nothing to it. this box may be
able to reach a registry; the box that scores this cannot, so a sixth package
will simply be missing when it runs, however well it worked while you built.
copy seed JSON into `/app`. `/assets` is only there while you build.
