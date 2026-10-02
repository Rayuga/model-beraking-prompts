# Colderwater strict candidate v7, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `4b13e7de45d2c3271606e57d51010f342b0d307fa3c648c019f6888c8a5fd9a9`
- Files: 43, single root `colderwater-playground-devtools/`
- Source: commit 5e565455 on branch `task/colderwater-editor-strict`; every file is byte-identical to `projects/colderwater-playground-devtools`.
- Frozen QC input: `8470a993bd214b41a71259c1dbcf3d6fdcc40bdcd6c59b90a16adfe615f40ee7` (`qc/runs/coldwater-strict-2026-10-02-r13`, prepared, no reviews run)
- Criteria: 1 render gate, 2 constraints gates, 42 Functional (weight 58.5), 6 Polish, 3 Visual.

Changes from v6, all from the full 54-reviewer round r12 on v6 (39 Pass, 10 Fail, 2 Not exercised, 2 Note; deterministic 44 Pass, 0 Fail, 3 Note, 1 N-A):
- Golden: Run no longer alters user code that contains dollar sequences such as `$'` or `$&`; double-click no longer treats a hyphen as part of a word; logged objects are shown expanded in the console.
- Notes: line and column are counted from one; a multi-caret typing burst lasts until a caret moves or something else is done, however slow the typing.
- Ctrl+Home and Ctrl+End are now actually graded in `cw_caret_kept_in_view`.
- One owner per defect: conflict feedback, stale preview output and "both modifiers add a caret" are each charged in one criterion only.
- Positive controls added: the first run must report the window property as defined; the newer-revision notice must be absent before the other tab saves; the restore retry must be seen to send a second request; every isolation probe must log a line.
- Closing "Fails if" lists now cover every stated step in six criteria; the find criterion no longer counts Next presses; the dynamic-code marker is built from two halves so a quoted refusal is not a failure.
- Undo and Redo availability is checked both after New and after opening a saved snippet.
- Save and library criteria now need a real mid-line edit, so storage alone cannot clear the Functional floor.
- Small wording: unique titles, filename restated before JavaScript criteria, three-digit sums, caret screenshot before the selection, the judge notes no longer assert that the editor is not a form field.

Status: test candidate, not cleared by a formal round. The scripted golden passes all 51 gate, Functional and Polish checks on these bytes and the three public-text hygiene checks pass. No reviewer has seen the v7 bytes. Not measured: Oracle and Luna scores for this version; QC rows 40 and 42 stay "Not exercised" until a graded mid-range run exists. v4, v5 and v6 are superseded.
