# Gambit Hollow — the club machine

Build the table in `/app`, with `serve.js`, `package.json` and `www/index.html`.
Start with `node serve.js` on port 3000, listening on all interfaces.
A successful `GET /api/health` says the server is available. Keep SQLite in
`/app/gambit.db`; honor `DB_PATH` when supplied for a relocated runtime.

Use plain browser HTML, CSS and JavaScript, no framework or browser build step.
Draw cards and the peg board as inline SVG, not canvas or fetched card images.
Use Express and SQLite. Node and global Express 5.1.0 / better-sqlite3 12.4.1
are supplied; package installation is also allowed during development.
Public networking is available during development and evaluation. Public
fonts/assets are allowed; the finished app must start without installing
packages or downloading game data. Saved game data stays on the local server.

This is one shared two-seat club machine, not a private-account service.
Players deliberately switch seats. In each seat view, the other player's
unplayed hand and crib contributions stay face down and absent from that
seat's response until revealed at the show. Your own discards remain known;
laid cards are public. There is no password or authentication requirement.

The data is under `/assets/club/`. `records/gambit_seed_data.json` supplies
five members and three historical game summaries; the unfinished historical
summary has no deal to resume. Preserve these records, but only offer newly
saved games with actual hands for resuming. Seed once: a process restart must
preserve later games, scores and ladder changes, not duplicate or reset them.

Give me a scoring bench to enter four cards and a cut, switch hand/crib,
and see the total and separate fifteens/pairs/runs/flush/nobs.
Use rank+suit codes (`AS`, `5H`, `TD`, `JC`); reject invalid/duplicate cards.
All forty examples in `scored-hands.js` must be reachable without random deals.
Also check a pegging pile plus its next card, showing count and scoring reasons.
Scoring experiments never change games or the ladder.

For repeatable practice offer the named deals in `practice-deals.json`.
Each starts at discard with the listed six cards per seat, dealer A and the
listed cut after discards. Keep the first four and discard the last two for
the exercise. Normal New game may shuffle, but saved deals never reshuffle.
Practice starts accept whole-number scores 0..120 for each seat. A practice
finish is a real game and updates the ladder once. Later hands alternate
the dealer and may shuffle normally.

Show player names, active seat, dealer, turn, hand number, count, cut, scores,
crib, cards already played and scoring commentary. Count automatically;
no manual point claims. Keep the show's separate breakdowns until Next hand.
A winning cut/play/show stops immediately at exactly 121 and refuses later
actions. Increment both players' played counts once and the actual winner's
won count once. Refused actions leave game and ladder intact.

Use labelled keyboard controls, visible focus, useful focus after actions,
announced feedback and textual refusals for illegal play. Prevent repeated
activation during a pending save. Keep a cohesive legible club-table design
across board, scoring bench, ladder and show at 1280×800 and 375×760, without
horizontal page overflow. Ordinary vertical scrolling is fine. Respect
reduced motion. A saved-game chooser should reopen existing playable games.

Put `APP_MANIFEST.md` beside `package.json`: a fenced `bash` start block
containing `node serve.js`, the absolute SQLite path `/app/gambit.db`, and
the actual main read/scoring/game-action routes. Routes are your choice except
the health probe. Reload and process restart must preserve all saved state.

Read `recovery.md` for the complete-match series, interrupted-save recovery,
per-game revisions and durable action receipts. Its automatic cut/show and
final-count display allowances apply to all practices and normal games.

Before handing over the table, use its browser controls to start a zero-score
game, discard for both seats and play a legal card. Reload, reopen the saved
game and continue with the next card. Check that the hand renders, cards can
be selected when allowed, and controls become usable again after loading or
saving. Watch the browser console and fix errors that prevent these actions.
Use a fresh browser page as well as the page where you first built the game.

Headless Chromium and Playwright are available for development checks. Chromium
is at `/usr/local/bin/chromium`. From Node, load the installed Playwright API
with `require('node:module').createRequire(require.resolve('@playwright/mcp'))('playwright')`.
Launch with `executablePath: '/usr/local/bin/chromium'`, `headless: true` and
`args: ['--no-sandbox']`. You can run browser checks from the terminal; an
interactive browser tool is not required. Keep the finished app's start command
as `node serve.js`; it should not install packages or launch test tools.
