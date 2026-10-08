# How the application runs

The application runs as one Node 22 process with Express and better-sqlite3
already available through NODE_PATH; use only those packages and Node
built-ins. The process starts from /app/server.js, listens on port 3000 on
0.0.0.0, and serves both the browser UI and the API. Starting records are in
/assets/seed_data.json. Keep the SQLite database at /app/app.db, honoring
DB_PATH when it is set. Restarting the process over the same database file
keeps all data, and seeding never duplicates records. GET /api/health answers
before database work can block startup.

The product is served from the local server. It may load external fonts,
scripts or CDN assets, but it cannot depend on an external backend or data
service. How routes and files are laid out under /app is up to you.

We copy /app as ordinary files when we deploy it, so please don't rely on
symbolic links outside /app/node_modules, and keep any link there pointing
inside /app/node_modules. The preinstalled packages are reachable through
NODE_PATH, so there's no need to link to where they're installed.

We start it as node /app/server.js from a different working directory under a
locked-down account, so find your files relative to the app itself and write
only under /app or wherever DB_PATH points.
