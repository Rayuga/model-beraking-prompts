# DropLine - Four in a Row

Build a complete browser game called **DropLine** for two people sharing one
device.

## Read these first

The product brief is split across every file under `/instructions/`. Read all
of `overview.md`, `gameplay.md`, `history-and-match.md`, `controls.md`,
`persistence.md`, and `interface.md` before implementing the app. They are one
brief split by topic and none is optional.

The initial product data is available at `/assets/dropline_seed.json`.

## Delivery

Place the finished application in `/app`. Include an `APP_MANIFEST.md` with
this fenced start block:

```bash start
npm start
```

The running application must expose `GET /health` for readiness checks and
`GET /api/config` for the supplied DropLine configuration.

The finished application should open directly into a usable match. It must not
need a route, selector, or implementation detail explained before somebody can
play it.
