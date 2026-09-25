# Gambit Hollow runtime

```bash
node serve.js
```

Entry `/app/serve.js`; browser `/app/www/index.html`; port 3000.
SQLite `/app/gambit.db`, overridable with DB_PATH.
Seed `/assets/club/records/gambit_seed_data.json`.

GET `/api/health`, `/api/ladder`, `/api/practice`, `/api/games`;
GET `/api/games/:id?seat=a|b` returns a seat-filtered saved game.
POST `/api/score`: hand, cut, crib; POST `/api/play/score`: pile, card.
POST `/api/games`: optional dealer/pone member IDs, practice preset ID and
start_scores with integer a/b values 0..120.
POST `/api/games/:id/discard`: seat and two cards;
POST `/api/games/:id/cut`, `/show`, `/deal`: seat;
POST `/api/games/:id/play`: seat and card.

This is a shared hot-seat table without account authentication.

All game reads expose `revision` (creation 0, +1 per accepted mutation).
Every POST to `/api/games` or its action routes requires an `Idempotency-Key`
header: 8..128 letters, digits, underscores or hyphens; the UI uses UUIDs.
Action routes also require `If-Match` containing the observed integer revision.
An accepted key is bound to path, input and expected revision. Identical retries
return the original status/body with `Idempotency-Replayed: true`; changed input
refuses with 409. Stale/missing revisions refuse with `code: stale_revision`.
SQLite commits game state, ladder updates and the receipt in one transaction.
Historical summaries (including completed games) are read at GET `/api/ladder`.
The browser stores an unconfirmed request in sessionStorage and exposes Retry
save after a lost response, including after reload, then reads the current game.
