# DropLine

can you build me a polished Connect Four game for two people sharing one
browser? i need real sign-in and saved game state, not a static mock. Show who
is signed in, keep each demo account's board and match totals separate, and
restore everything after a reload or a later sign-in.

yeah, let's add a visible move history with undo and redo too. Those actions
need to be real server-backed game operations and survive reloads, including
when an undo or redo changes a win or draw.

The full contract is in six files under `/instructions`; seeded accounts and
starting state are in `/assets/artifacts/dropline_seed.xlsx`.

Put the application in `/app`. Use vanilla HTML, CSS, and JavaScript in the
browser, Node.js with Express for the backend, and SQLite for durable storage.
Issue bearer tokens and store active tokens in SQLite. Start with
`node /app/server.js`, listen on port `3000`, serve `/app/public/index.html`,
and keep data in `/app/dropline.db`. Everything must work without runtime
installs or public-internet assets.
