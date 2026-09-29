# How the application runs

Please use React for the shop, with Node.js, Express and SQLite behind it. The supplied runtime is Node 22, with Express and better-sqlite3 available through NODE_PATH.

The finished app belongs in /app. We start it with node /app/server.js. The launcher's working directory is not guaranteed to be /app, so file access needs to work independently of it. It needs to listen on 0.0.0.0:3000, serve the UI from /app/public/index.html and answer GET /api/health successfully and promptly while preparing the shop.

The SQLite file is /app/app.db unless DB_PATH supplies another location. During development, copy the catalogue and photographs you need into /app. The inputs are /assets/seed_data.json and /assets/prints, but the delivered shop shouldn't need that original /assets directory to remain there.

Load the initial data when the database is empty. Starting again should keep the orders, checkout attempts, cancellations and stock we've already recorded; it shouldn't reload the starting quantities or duplicate records. The UI and APIs run in this one Node process, without an external database or backend service.

Network access is available during development and use. The shop may load external fonts, scripts or CDN assets, but it can't depend on an external backend or data service. Express, better-sqlite3 and Node built-ins are the available server-side runtime packages. You can organize the other files and routes under /app as you see fit.
