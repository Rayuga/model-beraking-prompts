# How we start the app

TypeScript, React and Vite would be convenient for the browser app, but the frontend tools are up to you. The supplied server runtime is Node 22 with Express and better-sqlite3 available through NODE_PATH.

Put the finished app in /app. We start it with node /app/server.js, and the current working directory may be outside /app. Resolve local files from their actual location rather than assuming where the command was started. It needs to listen on 0.0.0.0:3000, serve the workspace at / and answer GET /api/health successfully and promptly. The routes and file layout under /app are up to you.

The launch environment supplies PORT=3000, NODE_PATH=/usr/local/lib/node_modules and PATH=/usr/local/bin:/usr/bin:/bin. HOME points to the directory containing the running app copy. Use DB_PATH for the database location when it is supplied.

The database is /app/app.db unless DB_PATH supplies a different location. Saved snippets, identities and revisions need to survive a browser reload and a complete process restart over the same database. After restarting, I should have the same built-in example choices, without extra copies, and no duplicate saved records.

/assets/seed_data.json describes the starting scope. It contains no user snippets or implementation. Supply your own working examples as part of the playground.

Use Express, better-sqlite3 and Node built-ins for the one server process, without an external backend or database service. The browser app may load external fonts, scripts, editor components or CDN assets. The restrictions on code entered into the editor are described separately in /instructions/security.md.

Deliver ordinary files and directories in /app. Symbolic links are unsupported except links beneath /app/node_modules whose fully resolved targets also stay beneath /app/node_modules. Broken links are unsupported.
