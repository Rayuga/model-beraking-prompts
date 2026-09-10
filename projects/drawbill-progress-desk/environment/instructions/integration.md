# SQLite books

Finance reads SQLite — not a file the tablet happened to write, and not
anything sitting in the browser. How to reach it is in
`/assets/CREDENTIALS.md`.

- Keep the ledger at `/app/data/drawbill.db`. Ops re-cuts these boxes often
  and wipes `/app/data` along with any stray `*.db` / `*.sqlite*` when they
  do, so a boot that finds no ledger has to stand the schema back up and lay
  the seed down again from the artifacts by itself. Nobody is going to run a
  migration by hand at six in the morning.
- Create the schema and seed rows at startup, and make starting up safe to
  repeat: a boot that finds books already there leaves them alone rather than
  seeding a second time. Do not ship symlinks under `/app`.
- Artifact money is whole dollars. The ledger stores the pennies.
- Browser storage may remember which demo user is selected, and nothing else.
- Copy seed JSON into `/app` (or `/app/artifacts`) and load that copy.
  `/assets` is only there while you build.
