# How we hand it over

Build the interface with React, Vite and Tailwind, backed by Express and
SQLite. The dependency tree is already in the environment at
`/opt/torquebay-deps`, so do not reach out to a package registry while you
are building or when the app is running.

Keep the source and the running app together in `/app`. `/app/package.json`
needs working `build` and `start` scripts: `npm run build` should recreate
`/app/public/index.html`, and `npm start` should launch `/app/server.js`.

Leave `/app/APP_MANIFEST.md` next to the package file so we can see the
start command, how demo identity works, the main endpoint families, the
seed filenames and where the database lives. Serve that same note as plain
text from `GET /APP_MANIFEST.md`.
