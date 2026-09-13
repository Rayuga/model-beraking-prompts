# Brickfall notes

- App entrypoint: `node /app/server.js` on port 3000.
- SQLite database: `/app/brickfall.db`.
- Seed sources: `/assets/artifacts/brickfall_seed.xlsx` and `/assets/artifacts/brickfall_scenarios.json`.
- Workbook tables imported: Users, Levels, Bricks, Leaderboard, Constants.
- Seeded demo users: Mira, Dev, Polly; password is `password123`.
- Tokens are stored in SQLite and are 64-character lowercase hex strings.
- Current implementation keeps revision-safe receipts for run mutations and stores only Polly's latest ten terminal snapshots while retaining all leaderboard results.
- Mechanics lab uses fixture snapshots from the scenario file and advances with the shared canvas engine without touching saves.
