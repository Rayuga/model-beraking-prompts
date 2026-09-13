# Repository notes

- Seed data comes from `/assets/artifacts/dropline_seed.xlsx`.
- Two demo accounts are available: Avery Morgan and Jordan Lee, both with password `password123`.
- The server owns all Connect Four validation, history, undo/redo, revision checks, and archive replay data.
- Active tokens are stored in SQLite and sign-out revokes every active token for the signed-in account.
- Keep game state account-scoped and restore it from SQLite after reload or later sign-in.
