# Colderwater strict candidate v5, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `0bee37d32618269f67bc143a98deeede9caf7e06a19fee39b19a8036b61b9dc5`
- Single root `colderwater-playground-devtools/`, built with `git archive` from branch `task/colderwater-editor-strict`.
- Frozen QC input: `4bc6f3d980ff3016b9b8df0dfea189fcb1f41dd634531d4ad1401a36f9ae9034` (`qc/runs/coldwater-strict-2026-10-02-r11`)
- Criteria: 1 render gate, 2 constraints gates, 42 Functional (weight 58.5), 6 Polish, 3 Visual.

Changes from v4, all from the full 54-reviewer round r10 on v4 (45 Pass, 4 Fail, 2 Not exercised, 2 Note; deterministic 36 Pass, 0 Fail):
- `behaviour.md` now says errors are shown in the app console, and that an HTML file's error line counts from the file's first line.
- `ui.md` says Undo and Redo are disabled straight after New or opening a saved snippet.
- `cw_preview_isolation` plants a localStorage value and uses a hostile marker for the write probes; the judge notes allow that one extra script use and say read-only inspection is always allowed.
- The keyboard Polish criterion accepts arrow-key navigation inside a control group, not only Tab.
- Visual and constraints prompts: anchors override the generic 1 to 5 hint; say plainly when something could not be observed.
- Golden: event-handler attributes written by running code now work in the preview (`script-src-attr`); eval-style code stays refused.

Status: test candidate. The scripted golden passes all 51 gate, Functional and Polish checks on these bytes. No full round has been run on v5; only the rows that failed in r10 were rechecked (see `qc/runs/coldwater-strict-2026-10-02-r11`). Not measured: Oracle and Luna scores for this version. v4 is superseded.
