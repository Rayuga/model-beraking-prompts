# How the application runs

The runtime supplies Node 22, Express and better-sqlite3 through NODE_PATH. The application starts with node /app/server.js, listens on 0.0.0.0:3000 and serves the browser UI from /app/public/index.html. GET /api/health must answer successfully and promptly.

Use SQLite at /app/app.db, honoring DB_PATH when it is set. Saved snippets, their identities and revisions survive both a browser reload and a complete process restart over the same database. Starting again must not duplicate examples or library records.

The scope metadata is /assets/seed_data.json. It supplies no user snippets or implementation files. Examples are authored as part of the app and shipped under /app. Copy any required local assets into /app during development; the delivered runtime cannot rely on /assets or /instructions remaining available.

Use Express, better-sqlite3 and Node built-ins for the one server process. Build the TypeScript/React/Vite frontend during development and include its compiled local scripts and styles. Running or opening the delivered app must not install packages or fetch remote fonts, scripts, editor components or other assets. There is no external backend or database service.
