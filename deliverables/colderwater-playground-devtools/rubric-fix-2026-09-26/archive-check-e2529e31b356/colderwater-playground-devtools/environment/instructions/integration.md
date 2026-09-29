# How we start the app

Use TypeScript, React and Vite for the browser app, with Node.js, Express and SQLite behind it. The supplied runtime is Node 22; Express and better-sqlite3 are available through NODE_PATH.

Put the finished app in /app, including server.js, package.json, a lockfile and your source. We start it with node /app/server.js. It needs to listen on 0.0.0.0:3000, serve the UI from /app/public/index.html and answer GET /api/health successfully and promptly.

The database is /app/app.db unless DB_PATH supplies a different location. Saved snippets, identities and revisions need to survive a browser reload and a complete process restart over the same database. Starting again shouldn't duplicate examples or saved records.

/assets/seed_data.json describes the starting scope. It contains no user snippets or implementation. Include your examples in /app as part of the app, and copy any other required local assets there during development. The delivered runtime can't depend on /assets or /instructions remaining available.

Use Express, better-sqlite3 and Node built-ins for the one server process, without an external backend or database service. Build the frontend during development and include its compiled scripts and styles. Starting or opening the finished app mustn't install packages or fetch remote fonts, editor components or other assets.
