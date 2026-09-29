# How the application runs

The runtime supplies Node 22, Express and better-sqlite3 through NODE_PATH. The application starts with node /app/server.js from its application directory, listens on 0.0.0.0:3000, and serves the browser UI from /app/public/index.html. GET /api/health should answer successfully and promptly while startup prepares the shop.

Use SQLite at /app/app.db, honoring DB_PATH when it is set. Copy the catalogue and photographs you need from /assets into /app during development; the running delivery must not depend on the original /assets directory. The starting data is /assets/seed_data.json and the real print photographs are under /assets/prints.

Seed an empty database once. Subsequent starts keep orders, checkout attempts, cancellations and stock changes, without loading the initial data again or duplicating records. Serve both the UI and its APIs from this one Node process. There is no external database or backend service.

Build any React assets during development and include the finished local scripts and styles in /app. Opening or starting the delivered shop must not install packages or fetch external assets. Express, better-sqlite3 and Node built-ins are the available server-side runtime packages. How you organize the other files and routes under /app is up to you.
