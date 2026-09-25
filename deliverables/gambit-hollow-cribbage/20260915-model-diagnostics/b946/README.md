# b946 diagnostic browser reproduction

This is an isolated diagnosis of GPT-5.4-mini submission `gambit-hollow-cribbage__JvxTvGX`. Its official score remains **0.0**. No official task, golden solution, ZIP, submission artifact, or run output was edited. These checks are not an LLM regrade and establish no replacement score.

Real Chromium reproduced the reported disabled-card failure. Following that blocker through browser actions revealed two additional model implementation defects. Three small repairs in the final diagnostic copy were sufficient for the basic create/discard/play/reload flow.

| Copy | Changes relative to original | Observed browser outcome |
|---|---|---|
| `original/` | None | Fresh seed startup incorrectly opens a historical summary and gets HTTP 500. After explicitly labelled diagnostic setup with an API-created resumable game, UI creation shows six disabled cards. |
| `patched/` | Re-render game after clearing loading | Same fresh-seed issue. After diagnostic setup, all six cards are selectable, but the first discard is rejected with HTTP 400 because its expected revision is missing. |
| `patched-complete/` | Previous repair plus select only a resumable initial game, or none | Fresh-state UI loads five members without historical HTTP 500. First discard still fails for missing revision. This directory name refers only to the two UI repairs; it is not a claim of complete app correctness. |
| `patched-revision/` | Previous repairs plus initialize new game state revision to 0 | Fresh-state UI creates a zero-score practice game, discards through both seats, plays B's 5S, and retains the discarded and played state after reload. No API-seeded setup was required for this final copy. |

Exact patches are `browser-blocker.patch`, `history-selection.patch`, and `initial-revision.patch`.

The first bug renders cards while loading is true, then clears loading without updating them. The second treats non-resumable historical summaries as playable game states; those summaries omit fields such as `pegs`. The third stores initial revision 0 in the SQLite row and create response, but omits it from the JSON game state consumed by the browser. The browser consequently submits no `expectedRevision`, and the server correctly rejects its request.

Final browser evidence includes independent fresh GET reads after each meaningful mutation, first-discard reload retention, and played-card/count/revision retention. `browser-results.json` retains all original and intermediate failures. `browser-smoke.cjs` is the executable harness. Screenshots show fresh startup, created games, and the final played state.

The diagnostic runs used their own `gambit-diag-b946-20260915` container from cached image `brickfall-preflight-verifier:2.0.4`, real Chromium, and separate freshly seeded temporary databases. The container was stopped afterward. Current task assets were available at `/assets`; runtime fixture/rules/recovery/seed content matches the submission copies. The supplied README has subsequently changed in the main task; the archived submission README was preserved.

All 13 original submission files were checked against saved SHA256 values after the tests and remain unchanged. See `provenance.json` and `original-artifact-sha256.json`.

These repairs were deliberately limited to basic browser blockers. Full matches, recovery, hidden-card privacy, scoring, responsiveness, and overall rubric scores were not regraded here. No claim is made that the repaired submission passes the full task.
