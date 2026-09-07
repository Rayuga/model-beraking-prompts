# GridForge 2.0.3: golden solution corrections

Date: 2026-09-07. Upload `gridforge-spreadsheet-v2-2.0.3-task.zip`.
This is local engineering validation, not a new platform QC or Oracle score.

2026-09-08 update: the rebuilt ZIP also includes the approved instruction
clarification: at least 80 rows and 20 columns (A to T). This addresses the
subsequent QC minimum-grid-size finding. No scored verifier or golden code
changed in that follow-up. The comparison helper explicitly permits only
this one additional sentence; the validation details below describe the
original golden-fix scope.

## Why the previous Oracle missed the threshold

The retained platform run `run-44b1f2a8`, Oracle trial
`gridforge-spreadsheet-v2__XizsmDw`, completed normally with reward 0.8973:
Render 1, Constraints 1, Functional 0.9955, Polish 0.75. The no-op scored 0.
The two rejected criteria were `revision_preview_nonmutation` and
`keyboard_focus_and_grid_entry`. These were golden-app defects, not a network
or timeout failure.

## Changes to the reference app

- Revision previews render the complete saved cell snapshot, replacing the
  1,600-character truncation. The preview remains a scrollable, keyboard-
  focusable region and does not replace live cells or mutate server history.
- Toolbar controls retain native Tab/Shift+Tab and Enter behavior. The
  document-level grid handler no longer steals keys from focused controls.
  Tab can enter and leave the grid as a widget; selecting a cell activates
  spreadsheet navigation. Escape returns to widget navigation. Visible help
  explains this. Modifier keys alone do not activate cell navigation.
- Broader regression testing also exposed an existing in-flight save race.
  Save acknowledgements now preserve edits made after the request was sent,
  rebasing those edits onto the saved snapshot and scheduling another save
  when necessary. Previously the response could replace a newer local draft.

## Validation and retained QC work

- Four focused browser regressions fail against the untouched old Oracle
  artifact and pass against the updated golden solution. The delayed-save
  regression holds a real server response to test the race deterministically;
  it is an authoring test outside the task ZIP, not a scored verifier.
- All seven existing browser smoke groups pass: seed/custom grid, formulas,
  current-snapshot range Undo, cycle recovery, save/reload/session rejection,
  two real server restarts preserving data/history, and same-origin rendering
  without browser exceptions.
- Both GridForge images build. Real RewardKit discovery, shell/JavaScript
  syntax checks, and empty-submission reward-zero checks pass.
- 33/33 local packaging/structural checks pass. The upload contains 32 task
  files, no reports or test helpers, LF task text and executable shell modes.
- `check-gridforge-golden-only.py` compares every file with the retained
  2.0.2 ZIP. Only three golden UI files and release/version metadata changed.
  All instructions, criterion descriptions, weights, gates, timeout/network
  settings, pinned dependencies, lifecycle scripts and restart/manifest
  checks remain unchanged. Prompt bodies are identical apart from their
  matching 2.0.3 version markers.
- Scoring remains 44 criteria: 2 Render, 2 Constraints, 36 Functional and
  4 Polish, with the same hard gates and 60/40 Functional/Polish split.

Evidence is in `gridforge-oracle-regression-before.json`,
`gridforge-oracle-regression-after.json`, `gridforge-smoke.json`,
`gridforge-golden-only-comparison.json`, `image-validation.json` and
`structural-checks.json`, alongside this report and outside the upload ZIP.

## Next platform step

Run Oracle and QC on the 2.0.3 upload. The previous 0.8973 belongs to 2.0.2;
these local regressions are not a replacement full Oracle score. Keeping
the rubric contracts unchanged prevents deliberate regression of previous
fixes, but cannot guarantee a future platform/judge verdict.
