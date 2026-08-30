# Engineering policy

## Stack and shape

- **Node.js** backend. A **relational store** persisted to disk — SQLite is
  fine and is what the reference build uses; PostgreSQL is equally acceptable.
- **One process**, listening on **port 3000**, serving both the API and the
  interface. The same origin serves the pages and the data.
- `GET /health` must answer as soon as the process is up and must never be
  gated behind seeding, a migration, or anything external. An app that does not
  answer on 3000 cannot be assessed at all.
- Start with `npm start` from the app root.

## State

- **Everything is persisted to disk.** In-memory state does not survive, and the
  work below is graded as one long session against one continuous database —
  records written in the first few minutes are read back much later.
- **Seed once.** If the database already holds data, do not re-seed and do not
  reset it. Re-seeding on every boot wipes work that has already been done.
- Seed from `/assets/artifacts/signalworks_seed_data.json` exactly, with the ids
  as given. Do not invent parallel ids for anything that file already names.

## What you choose

Routes, URL paths, request and response field names, element ids, button
labels, navigation wording and status spellings are **all yours**. Nothing is
prescribed and nothing is graded on its spelling. What is graded is what the
system *does* and what it *shows*.

Describe the choices you made in `APP_MANIFEST.md` at the app root.

## Money and time

- Money is **integer pence** in storage and arithmetic. Do not hold money in
  floating point.
- Durations are **integer minutes**.
- Round **half-up to the penny** wherever a rounding is called for, and round
  each component of a total in its own right before adding them.
- Times are ISO instants in UTC and are compared against other stored instants.
  Nothing depends on the current time, and nothing needs a clock you can wind.

## Dependencies

Keep them modest and install them properly with a lockfile so the build is
reproducible. There are **no third-party services** in this task: no payment
provider, no mapping API, no mail service, no document service, and no network
calls of any kind are needed or expected.
