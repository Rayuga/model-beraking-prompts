```bash
node serve.js
```

SQLite database: `/app/gambit.db`

Main routes:
- `GET /api/health`
- `GET /api/bootstrap?seat=A|B&gameId=...`
- `GET /api/games`
- `GET /api/games/:id?seat=A|B`
- `GET /api/history/:id`
- `POST /api/games`
- `POST /api/games/:id/actions`
- `POST /api/scoring/hand`
- `POST /api/scoring/pegging`
