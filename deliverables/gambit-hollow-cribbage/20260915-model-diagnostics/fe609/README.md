# fe609 diagnostic copy

This is a diagnostic repair of an archived model submission, not a task revision, benchmark score, or Oracle result. Original run outputs and the source task are unchanged.

Run: `run-fe6099da-6ee8-437b-9da4-1de191fd2837`, trial `gambit-hollow-cribbage__aQshxcW`.

## One-line repair

The submitted `www/shared.js` exports browser helpers as `globalThis.CribbageRules`. The submitted `www/app.js` refers to `Rules` without defining it. The diagnostic copy adds `const Rules = globalThis.CribbageRules;` inside the existing IIFE. See `fix.patch`. No other application source was changed; `provenance.json` records hashes of every original file and verifies originals remained unchanged after testing.

## Browser evidence

`browser-probe.cjs` ran real Chromium inside the existing cached verifier image `brickfall-preflight-verifier:2.0.4`. Original and repaired servers used separate, freshly seeded SQLite databases in the disposable container. The archived databases were copied intact for provenance but were not opened or modified. These tests address code behavior on a new session, rather than archived judge game state.

- Original: creating a practice game succeeded at the API, but the UI displayed **Rules is not defined** and rendered **zero card buttons**. See `original-after-create.png` and `browser-results.json`.
- Repaired: creating the same practice game rendered 12 card buttons, including hidden opponent cards.
- Repaired: the browser selected and submitted two recommended discards for each seat; both requests returned 200.
- Repaired: the browser played Seat B's 5S. An independent API read verified count 5 and turn A.
- Repaired: a complete page reload retained the game, revision and count 5, and the UI rendered that count. See `repaired-after-play-reload.png`.

## Additional issue left unchanged

Both copies emitted `Cannot read properties of null (reading 'commentary')` during initial rendering with no selected game. This is separate from the missing helper alias. The repaired copy could still create a game and finish the browser smoke sequence. No other repair was made.

This is a limited create/discard/play/reload smoke test. It does not establish full gameplay correctness, all verifier outcomes, a benchmark score or visual quality. No LLM judge was run.

The diagnostic container `gambit-diag-fe609-20260915` was stopped after testing and exposes no host port.
