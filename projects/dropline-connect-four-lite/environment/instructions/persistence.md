# Server state and persistence

The server owns move validation, gravity, turn changes, win and draw detection,
terminal locking, account isolation, and score changes. Browser-only state is
not sufficient.

Persist every accepted move and New game action before reporting success. A
page reload and a later sign-in must restore that account's exact 42 cells,
current turn or terminal result, winning cells, and all three match totals.
Rejected full-column and terminal moves must not produce a partial database
change or increment a total.

Serve authentication, state reads, and state changes from the same origin as
the browser application. Do not depend on external scripts, stylesheets, fonts,
images, APIs, or other public-network assets. Provide a same-origin health
response that succeeds when the server is ready.
