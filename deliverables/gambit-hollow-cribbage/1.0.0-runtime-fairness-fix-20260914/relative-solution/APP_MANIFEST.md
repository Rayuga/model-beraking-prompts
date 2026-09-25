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
