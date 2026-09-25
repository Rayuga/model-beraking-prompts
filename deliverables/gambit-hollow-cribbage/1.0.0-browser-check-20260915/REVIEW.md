# Gambit browser acceptance check

[Upload ZIP](gambit-hollow-cribbage.zip)

SHA-256: `06a4f99349469c181d51b8da5520fa0c8bc02332c0433cbfc0d826b374e57f6a`.

## Changes

Only four task files changed from the complete-match candidate:

- `instruction.md`: asks the builder to use the actual browser controls to create a zero-score game, discard for both seats, play, reopen and continue, fixing blocking browser errors.
- `environment/assets/club/README.md`: explains the same acceptance flow and how a terminal-only agent can launch the supplied browser tools.
- `tests/assets/club/README.md`: identical mirrored notes.
- `environment/Dockerfile`: adds `@playwright/mcp@0.0.79` and its bundled Chromium, reusing the verifier's pinned package/install approach. This is development tooling; the delivered app still starts with `node serve.js`.

Every golden file, all five judge TOMLs/prompts, task.toml, tests/Dockerfile, test.sh, lifecycle helper, criterion weights and reward configuration are byte-identical to the preceding candidate. There are still 55 criteria (40 Functional), with the same global browser gate, 60/20/20 weights and timeouts. No model-specific bug names or fixes were added to the brief, and no test-report artifact was made a new graded requirement.

## Validation

- 401 local archive checks passed on the actual ZIP, including canonical asset paths and shell permissions.
- 134 reference configuration checks passed.
- A terminal-driven Chromium run using the documented module import and launch options passed five browser acceptance groups against the unchanged golden solution: initial page, zero-score creation and both discards, legal play with persistence, reopening and continuing on a fresh page, and no uncaught browser errors.
- Browser validation ran with networking disabled in the cached `brickfall-preflight-verifier:2.0.4` image. Results are in [browser-acceptance-results.json](browser-acceptance-results.json). These are behavioral checks, not LLM scores.
- The new environment's fresh build failed at the pre-existing apt step because the configured proxy could not resolve. A separate command-only retry with inherited proxy arguments cleared stalled reaching Debian; it was cancelled. Both build logs are preserved. The documented browser API works with the exact pinned cached tools, but a successful fresh environment image build is not claimed.

The shared local upload checker had changed to accept only weighted_mean for every dimension. That incorrectly rejected the unchanged, previously accepted Gambit render/constraint all_pass gates. The checker now accepts either weighted_mean or all_pass only for Render/Constraints and continues to require weighted_mean for Functional/Polish/Visual. Four fixture checks cover preserved gates, reference weighted gates, and rejection of invalid Functional/Visual all_pass aggregation. See [aggregation-results.json](aggregation-results.json). This is a local checker correction; no task scoring policy changed.

## Model diagnosis

Separate model copies and exact patches live in [the diagnostic directory](../20260915-model-diagnostics/). Original run artifacts and recorded zero scores remain untouched.

- fe609: binding the browser's existing CribbageRules API enables the create/discard/play/reload flow. A separate initial null-commentary error remains documented in that diagnostic copy.
- b946: the staged copies show three bugs: cards remain disabled after loading, initial selection opens an unplayable historical record, and new state omits revision zero. The final diagnostic copy with those three small repairs passes the basic browser flow from fresh data.

These diagnostics confirm that backend-only verification missed real browser integration defects. They do not establish new full-rubric scores or replace the model submissions. The task change encourages real browser verification while retaining all harder gameplay/recovery requirements.

The user reports that Oracle passes the preceding expanded task. No new Oracle or GPT trial was run for this guidance/tooling revision; a target GPT score near .4 remains unverified. The exact matching golden/verifier hashes are recorded in [changes.json](changes.json) and [source-sha256.json](source-sha256.json).
