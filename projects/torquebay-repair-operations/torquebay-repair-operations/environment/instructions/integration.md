# How it should run

One Node 22 process with Express, serving both the API and the built React
app. Bind to `0.0.0.0`, honor `PORT` when it is set, otherwise use port
`3000`. `GET /health` should answer so we can tell the desk is up. Keep
SQLite through `better-sqlite3` on disk: honor `DB_PATH` when it is set,
otherwise keep the database at `/app/torquebay.db`.

Copy `customers_seed_data.json`, `shop_floor_seed_data.json` and
`staff_seed_data.json` from `/assets/artifacts/` into `/app` and start a
fresh database from those copies. Shop pages and shop data should come
from this origin. There is no payment processor and no outside login.
