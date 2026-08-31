# DropLine

Can you build me a polished full-stack Connect Four game for two people sharing
one browser? I need real sign-in and durable game state, not a static mock. Show
who is signed in, keep each demo account's board and match totals separate, and
restore its current game after a page reload or a later sign-in.

The complete product contract is split across the five files in
`/instructions`. Seeded accounts and their starting game state are supplied in
`/assets/artifacts/dropline_seed.xlsx`.

Put the application in `/app`. Use vanilla HTML, CSS, and JavaScript in the
browser, Node.js with Express for the backend, and SQLite for durable storage.
The server must issue bearer tokens and store active tokens in SQLite. It must
start with `node /app/server.js`, listen on port `3000`, serve the UI from
`/app/public/index.html`, and keep data in `/app/dropline.db`. Everything must
work without installing packages at runtime or loading assets from the public
internet.
