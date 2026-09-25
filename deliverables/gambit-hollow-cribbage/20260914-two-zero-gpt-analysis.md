# Two zero-scoring GPT runs

Both supplied exports identify the model as **gpt-5.4-mini**, agent openhands-sdk 1.44.1. Neither trial has an agent or verifier exception. Both have task checksum `347ff83c44725329b484bc1a9b06eebd057856bd950d5abab33fac7db43f4a65`. All prompt/judge, runner and reward-config provenance hashes match current Gambit source.

The Oracle passes according to the user's platform result. The current run-outputs/gambit-hollow-cribbage directory contains only these two GPT trials, so this review does not independently establish the Oracle's numerical score or checksum.

| Run | Trial | Agent duration | Shared gate failure |
|---|---|---|---|
| fe6099da-6ee8-437b-9da4-1de191fd2837 | aQshxcW | About 10m33s | `Rules is not defined` prevents the hand from rendering |
| b946654c-ab17-4c84-8621-ce48019d75ce | JvxTvGX | About 16m57s | All new-game card buttons remain disabled |

Both completed well within the 7200-second agent limit. Both received render/constraints/functional/polish/visual/reward = 0 through the common browser gate. A working ladder and successful create request are insufficient: the published gate requires selecting and discarding two cards through the UI, followed by a fresh read retaining the discard. Neither app can complete that step. The 40 functional criteria are marked no through the gate; this is not evidence that each underlying mechanic failed its individual test.

## fe609: mismatched browser rules binding

Submitted `artifacts/app/www/shared.js:5` exports its browser API as `root.CribbageRules`. The HTML loads shared.js before app.js. However, `www/app.js` never binds a `Rules` variable and uses `Rules.cardLabel(code)` in `cardButton()` at line 157, with other Rules references later. The server's separate `const Rules = require('./www/shared.js')` does not define a browser global. All five judges consistently report this ReferenceError and missing hand controls.

A small diagnostic correction would bind the browser API correctly, for example `const Rules = window.CribbageRules` in app.js. This review did not modify the submitted artifact or claim that this correction makes the rest of the app correct.

## b946: cards rendered while busy stay disabled

Submitted `artifacts/app/www/app.js:564–602` sets busy/loading true, loads data, calls renderGame while loading remains true, then clears busy in finally. renderGame at lines 455–474 emits disabled card buttons when loading is true. setBusy at lines 172–181 only updates toolbar buttons; clearing loading does not update those card buttons. Every reload/seat switch repeats the sequence.

A limited executable Node VM probe of the unmodified submitted functions, with a successful mock bootstrap response, confirmed loading=false afterward but all six cards still disabled. An additional renderGame call after loading clears removed all six disabled attributes. This is source-level reproduction, not a full browser regrade.

There is also an HTTP500 on historical game loading, recorded in verifier/app.log. `serve.js:499` tries to clone missing `state.pegs` from historical data. That is a separate issue; the disabled fresh-game cards independently establish the gate failure. An isolated unsupported historical selection error should not alone zero an otherwise functioning new-game flow.

## Why model verification missed it

Both trajectories show Node/scoring and curl/API checks, including successful game creation and direct discard requests. Neither contains a browser test. Their installed tool sets list terminal, file_editor and task_tracker; terminal-based browser testing would require available or installed browser tooling. Successful backend checks did not validate JavaScript browser bindings or clickable card state.

## Recommended next step

Keep the minimum gameplay gate and 60/20/20 formula. Lowering the gate to permit an unplayable table would restore the earlier polished-shell scoring problem.

Add a general acceptance check to the product notes: before finishing, open the actual page in a browser, create a zero-score game, discard for both seats, play a legal card, reload and confirm continued play. Ensure the development workflow has usable browser-test tooling within the agreed task-image standard. Do not add model-specific hints naming either implementation's bug.

For diagnosing the deeper difficulty, use separately labelled copies of these submissions, repair only their blocking UI defects and inspect the remaining requirements. Any resulting diagnostics must not replace their original official zero scores. Alternatively run fresh model attempts after the general browser-testing guidance. Only then calibrate advanced requirements toward an informative score range; these two runs do not show whether those harder requirements would yield approximately .4.

No task files, golden files, uploaded ZIP, or supplied run artifacts were changed during this analysis.
