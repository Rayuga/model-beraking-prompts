# Server state and persistence

The server owns move validation, gravity, turn changes, win and draw detection,
terminal locking, account isolation, score changes, move history, undo, and
redo. Browser-only state is not sufficient.

Persist every accepted move, undo, redo, and New game action before reporting
success. Reload and later sign-in restore the exact board, turn or result,
winning cells, totals, applied history, and redo availability. Rejected moves
or history actions must not produce a partial database change.

Serve authentication, state reads, and state changes from the same origin as
the browser application. Do not depend on external scripts, stylesheets, fonts,
images, APIs, or other public-network assets. Provide a same-origin health
response at `GET /api/health` that succeeds when the server is ready.
