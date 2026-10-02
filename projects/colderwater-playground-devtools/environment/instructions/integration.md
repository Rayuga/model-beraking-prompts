# How we start the app

Put the finished app in /app. We start it with node /app/server.js from a working directory that may be outside /app. Resolve files from their actual location. Listen on 0.0.0.0:3000, serve the workspace at / and answer GET /api/health promptly.

The launch image supplies Node 22, Express and better-sqlite3 through NODE_PATH. You may choose your routes and frontend tools. Include everything needed at runtime; opening the finished app must not require an install or build step. Network is public for the app, but user-entered preview code has the boundary in security.md.

Saved snippets, identities and revisions must survive page reloads and complete process restarts. The library must be shared between independent browser contexts. /assets/seed_data.json describes the starting scope and contains no user snippets or starter implementation.

Use SQLite for persistent records. The default database path is /app/app.db. If DB_PATH is set, open that absolute path instead, including when the app runs from a writable copy outside /app. Keep the same records and revision history after a process restart.

Deliver ordinary files under /app. Symbolic links are unsupported except links under /app/node_modules whose resolved targets also stay under /app/node_modules.
