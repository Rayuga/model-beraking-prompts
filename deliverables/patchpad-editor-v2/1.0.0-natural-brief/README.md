# PatchPad: natural main brief

Prepared 2026-09-11. Upload: `patchpad-editor-v2.zip`, version 1.0.0, 32 files.
SHA-256: `3fd7b93f0c949c85b3d6af4383493d8f0134563c29b806e8c980ccb9db438034`.

The main prompt is now a short product request with pointers to the seed and
five detailed brief files. Repeated runtime/manifest instructions have been
consolidated in `overview.md`. The documented `/app`, npm start, port 3000,
root page, local runtime assets and SQLite manifest requirements are retained
because the runner and existing checks depend on them. Layout, internal
organization and implementation remain the builder's choices within the brief.

Only `instruction.md` and `environment/assets/instructions/overview.md` changed.
App code, all verifiers, scoring, seed, timeouts and Dockerfiles are unchanged.
88 structural checks and package CRC/content/hash checks passed. No new browser
or oracle execution was needed for this wording/consolidation change or claimed.
Prior build limitations and pending full oracle/QC remain as documented in the
preceding releases. The Polish error-feedback ambiguity is still awaiting the
user's decision; this wording change does not alter it.

The golden preview remains at http://localhost:3034/. The earlier package is
preserved in `before-natural-brief.zip`. Use `package.py` to rebuild this release.
