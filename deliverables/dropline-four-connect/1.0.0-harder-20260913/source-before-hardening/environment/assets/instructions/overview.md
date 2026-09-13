# Product overview

DropLine is a local Connect Four game for two people taking turns in one
browser. It should feel like a finished board-game product rather than an
engineering demo. The current turn or result, board, column controls, match
totals, current account, and available actions should be easy to understand.

Keep the product focused. It needs sign-in, sign-out, one active game for each
account, durable match totals, current-round move history, and undo and redo.
It does not need public registration, computer opponents, chat, tournaments,
spectator mode, or administration screens.

Run one non-watch server on `0.0.0.0:3000`. Put the application in `/app`, start
it with `node /app/server.js`, serve the browser UI from
`/app/public/index.html`, and keep durable data in `/app/dropline.db`. Use
vanilla HTML, CSS, and JavaScript in the browser, Node.js with Express on the
server, and SQLite as the source of truth. The installed Express and
better-sqlite3 packages plus the xlsx workbook reader are available without a
runtime install. Network access and dependency installation are allowed during
development; deliver the dependencies needed to start the server.

Leave `APP_MANIFEST.md` beside `server.js`, documenting the start command,
SQLite path, and the methods and paths used for sign-in, sign-out, reading game
state and each mutation. Shared routes are fine. Write the database line as
`SQLite path: /app/dropline.db`. Normal restarts must retain saved state.
Honor `DB_PATH` when supplied by the runner; otherwise use `/app/dropline.db`.
The runner can launch a writable copy of the app as an unprivileged user.
