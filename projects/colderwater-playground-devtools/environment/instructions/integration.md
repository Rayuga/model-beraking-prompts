# How I start the app

Put the finished app in /app. I start it with node /app/server.js from a working directory that may be outside /app. Resolve files from their actual location. Listen on port 3000 on 0.0.0.0 (PORT is set to 3000 at launch), serve the workspace at / and answer GET /api/health promptly.

The launch image supplies Node 22, Express and better-sqlite3 through NODE_PATH. You may choose your routes and frontend tools. Include everything it needs at runtime; I won't run an install or build step before opening it. The app may load external fonts, scripts and other CDN assets, but user-entered preview code has the boundary in security.md.

Saved snippets, their record ids and revisions need to survive page reloads and complete process restarts, and the library is shared between independent browser contexts. /assets/seed_data.json describes the starting scope and contains no user snippets or starter implementation.

Use SQLite for persistent records. The default database path is /app/app.db. If DB_PATH is set, open that absolute path instead, including when the app runs from a writable copy outside /app. Keep the same records and revision history after a process restart.

Deliver ordinary files under /app. Symbolic links are unsupported except links under /app/node_modules whose resolved targets also stay under /app/node_modules.
