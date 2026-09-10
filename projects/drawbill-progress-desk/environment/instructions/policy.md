# Demo identity and deliverables

A fresh browser defaults to Avery Lin. A clearly labeled user switcher
changes the active seeded identity. Document how identity works in
`APP_MANIFEST.md`.

Place `APP_MANIFEST.md` at the project root next to `package.json` with a
`bash install` fence (`npm ci --omit=dev --offline --cache /opt/npm-offline` from `/assets/npm-pin/`), a `bash start` fence that
boots port 3000, how demo identity works, the main HTTP endpoints you chose,
and how SQLite is reached. Serve that same file back at `GET
/APP_MANIFEST.md` — ops read it in a browser instead of shelling into the box.
