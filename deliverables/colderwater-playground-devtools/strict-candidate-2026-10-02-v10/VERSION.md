# Colderwater strict candidate v10, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `4b8147d1d42261cd4340d6a897ec057d325a5b3cde75c1b807e9f56f7c763dc1`
- Files: 43, single root `colderwater-playground-devtools/`, LF line endings
- Source: commit 5d68d1b9 on branch `task/colderwater-editor-strict`; every file is byte-identical to the committed `projects/colderwater-playground-devtools`.
- Criteria: 1 render gate, 2 constraints gates, 43 Functional (weight 59.0), 6 Polish, 3 Visual.

Changes from v9 (which passed round r16 with 49 Pass, 0 Fail, 3 Note, 1 Not exercised; deterministic 37 Pass, 0 Fail), four wording tidy-ups taken from that round's notes:
- `instruction.md` names the start command `node /app/server.js` and the data file `/app/app.db`.
- `behaviour.md` says inline scripts and handler attributes such as onclick must work in a complete HTML file.
- The Stop step inside `cw_last_good_recovery` names its draft (marker, then a four-second timer, Stop as the next action).
- The WebAssembly refusal check names the valid eight-byte empty module.

No golden code changed since v9. Scripted golden on these bytes: 52 of 52 gate, Functional and Polish checks, with a real restart; the three public-text hygiene checks pass.

Status: no reviewer round has been run on the v10 bytes; the last full round (r16) was on v9. Not measured: Oracle and Luna scores. Left as is: `XXX` substrings inside the vendored bundle and a lockfile hash. v4 to v9 are superseded.
