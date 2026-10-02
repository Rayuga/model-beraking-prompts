# Colderwater strict candidate v6, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `1e211a484447a79324335de3e92b438158aca6bd80ac54ab3a8d4a4e14a98913`
- Files: 43, single root `colderwater-playground-devtools/`
- Source: commit 6b6bd806 on branch `task/colderwater-editor-strict`; every file is byte-identical to `projects/colderwater-playground-devtools`.
- Frozen QC input: `3f132f2758fd93cca0bfe425d942f454a7cedd0670b1208e8175c54c3ec78242` (`qc/runs/coldwater-strict-2026-10-02-r12`, prepared, no reviews run)
- Criteria: 1 render gate, 2 constraints gates, 42 Functional (weight 58.5), 6 Polish, 3 Visual.

Changes from v4:
- From the full 54-reviewer round r10 on v4 (45 Pass, 4 Fail, 2 Not exercised, 2 Note; deterministic 36 Pass, 0 Fail): errors are stated to go to the app console; `cw_preview_isolation` plants a stored value and uses a hostile marker; the keyboard Polish criterion accepts arrow-key toolbars; prompt wording clarified; handler attributes written by running code work in the golden preview.
- From the five-row recheck on v5 (`qc/runs/coldwater-strict-2026-10-02-r11`: rows 4 and 27 Fail on new points, rows 18 and 31 Note, row 30 Pass):
  - `ui.md` names Ctrl/Cmd+Home and Ctrl/Cmd+End, and says a repeat Format adds no Undo step; the caret criteria name the keys.
  - `behaviour.md` says history inspection shows title, filename and source.
  - The restore replay uses the recorded headers too, and the step is left out when an app offers nothing to retry or replay.
  - In both stale-save criteria tab B edits before tab A saves.
  - Golden: the code area takes focus as soon as Save is pressed, so a key pressed while the request is in flight is kept.

Status: test candidate, not cleared by a formal round. The scripted golden passes all 51 gate, Functional and Polish checks on these bytes and the three public-text hygiene checks pass. No reviewer has seen the v6 bytes. Not measured: Oracle and Luna scores for this version. v4 and v5 are superseded.
