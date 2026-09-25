# DropLine

can you build me a polished Connect Four game for two people sharing one
browser? i need real sign-in and saved game state, not a static mock. Show who
is signed in, keep each demo account's board and match totals separate, and
restore everything after a reload or a later sign-in.

yeah, let's add a visible move history with undo and redo too. Those actions
need to be server-backed and survive reloads, including when they change a win
or draw. It should also behave safely in two tabs: reject stale or duplicate
actions, sign the account out everywhere, and keep a completed-match archive
with read-only replay.

I'd also like to study games afterwards. Let me turn any replay position into
a named, saved practice analysis, try different continuations without losing
earlier branches, and compare two positions. Keep practice completely separate
from competitive scores. The analysis workspace and its two-tab behavior are
described in `/assets/instructions/analysis.md`.

For deeper study, let me preview and copy a whole continuation branch to a
different position, safely keeping its alternatives. I'd also like bounded
tactical reports that explain forced wins and losses with a browsable reply
tree. The precise study-tool behavior is in `/assets/instructions/study-tools.md`.

The full contract is under `/assets/instructions`; seeded accounts, different starting
states, and initial completed matches are in `/assets/artifacts/dropline_seed.xlsx`.
Put the application in `/app`. Use vanilla HTML, CSS, and JavaScript in the
browser, Node.js with Express for the backend, and SQLite for durable storage.
Issue bearer tokens and store active tokens in SQLite. Start with
`node /app/server.js` on port `3000`, serve `/app/public/index.html`, and keep
data in `/app/dropline.db` without server-startup installs. Public browser assets
are allowed; game state and authentication must stay on the local server.
