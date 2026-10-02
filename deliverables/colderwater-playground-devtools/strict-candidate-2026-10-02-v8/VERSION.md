# Colderwater strict candidate v8, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `6852d705e2c757a678f59a5e74cb694760144b0a5eff14708a4e81c21ce6e20b`
- Files: 43, single root `colderwater-playground-devtools/`
- Source: commit a517b936 on branch `task/colderwater-editor-strict`; every file is byte-identical to `projects/colderwater-playground-devtools`.
- Frozen QC input: `d5727a2da8d7d06ffea14740e5437a7791199fef4e77632bf4c36e55862e5938` (`qc/runs/coldwater-strict-2026-10-02-r14`, prepared, no reviews run)
- Criteria: 1 render gate, 2 constraints gates, 43 Functional (weight 59.0), 6 Polish, 3 Visual.

Changes from v7, all from the full 54-reviewer round r13 on v7 (45 Pass, 6 Fail, 2 Note; deterministic 41 Pass, 0 Fail, 3 Note, 4 N-A):
- Rows 26, 34: the slow multi-caret burst is now actually performed (type MUL, wait three seconds, type TI); the ungraded sentence about what ends a burst was removed from the notes; the saved source in `cw_save_reload_restart` now carries an HTML tag, an ampersand and the word eval, so "save source as text" is graded.
- Row 28: the restored last-good picture is graded only in `cw_last_good_recovery` (after an error, after Stop and after the time limit); the line and column readout is graded only in `cw_caret_navigation_and_line_numbers`.
- Rows 32, 33: the repeated restore request is a new criterion, `cw_restore_request_repeat_safe` (weight 1.0), defined as a replay of the recorded request and never a second press of Restore; `cw_history_restore_retry` drops that step and is weight 1.0. The notes say saves and restores are ordinary HTTP requests. Find no longer claims to tell a selection from a highlight; the drag selection is anchored to word starts.
- Row 33: closing "Fails if" lists completed for Undo/Redo availability, promise rejection and grapheme deletion.
- Row 48: the visual prompt no longer contradicts the contrast and colour criteria; reading a highlight only counts where a criterion does not ask for the copied text.
- Notes taken: one judge note to match the filename ending before every Run; PORT named in the launch note; first person throughout the launch note; caret visibility added to a middle visual anchor.
- Golden: Format on a draft that ends with a line break and is already formatted is a no-op.

Status: test candidate, not cleared by a formal round. The scripted golden passes all 52 gate, Functional and Polish checks on these bytes and the three public-text hygiene checks pass. An independent reviewer in r13 also drove the v7 golden with its own fixtures and found no failing criterion. No reviewer has seen the v8 bytes. Not measured: Oracle and Luna scores for this version. v4 to v7 are superseded.
