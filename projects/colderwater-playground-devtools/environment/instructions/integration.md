# How we start the app

TypeScript, React and Vite would be convenient for the browser app, but the frontend tools are up to you. The supplied server runtime is Node 22 with Express and better-sqlite3 available through NODE_PATH.

Put the finished app and everything it needs to start in /app. We start it with node /app/server.js. It needs to listen on 0.0.0.0:3000, serve the UI from /app/public/index.html and answer GET /api/health successfully and promptly.

The database is /app/app.db unless DB_PATH supplies a different location. Saved snippets, identities and revisions need to survive a browser reload and a complete process restart over the same database. Starting again shouldn't duplicate examples or saved records.

/assets/seed_data.json describes the starting scope. It contains no user snippets or implementation. Include your examples in /app as part of the app, and copy any other required local assets there during development. The delivered runtime can't depend on /assets or /instructions remaining available.

Use Express, better-sqlite3 and Node built-ins for the one server process, without an external backend or database service. Build the frontend during development and include its compiled application scripts and styles. The browser app may load external fonts, scripts, editor components or CDN assets. Starting the app mustn't install packages. The restrictions on code entered into the editor are described separately in /instructions/security.md.

Deliver ordinary files and directories in /app. Symbolic links are unsupported except links beneath /app/node_modules whose fully resolved targets also stay beneath /app/node_modules. Broken links are unsupported.
