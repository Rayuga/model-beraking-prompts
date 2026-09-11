DrawBill
========

Half-started. I got as far as deciding the boring parts, so here is what is
settled. Please do not relitigate the stack.

The app lives in `/app`. One Node process on port 3000. Express. Vanilla
front end. SQLite through Node's own `node:sqlite`
(`node --experimental-sqlite`). The plant's card desk takes the card.
Nothing pulled off a CDN.

`APP_MANIFEST.md` at the app root, with a `bash install` fence
(`npm ci --omit=dev --offline --cache /opt/npm-offline`) and a `bash start` fence
that boots port 3000.

Seed: `/assets/artifacts/` — companies, people, jobs, and the plant JSON.
Copy those files into `/app` and load that copy on first boot, ids and all.
`/assets` is only there while you build.

How the plant behaves is in CREDENTIALS.md here and under `/instructions/`.
