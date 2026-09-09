# GridForge 2.0.1: platform QC corrections

Use gridforge-spreadsheet-v2-2.0.1-task.zip instead of the earlier 2.0.0 ZIP.
This is a local validation report, not a new platform verdict or Oracle score.

## Corrections

- All four dimension prompts allow a normal seeded-user entry screen before
  checking the workbook, including after reload and in fresh browser contexts.
  The first Functional criterion no longer demands a workbook immediately
  before the user chooses their identity. No undisclosed credentials or API
  bypass are allowed.
- Polish accepts equivalent fill buttons, menus or discoverable drag handles.
  It no longer requires two separately named directional buttons. User
  selection may be on the entry screen rather than the workbook toolbar.
- Numeric display comparisons accept equivalent formatting such as 360 and
  360.00. Raw formulas, text, addresses and revision/count expectations remain
  exact; incorrect calculated results still fail.
- The name-box/delete/Undo criterion captures all nine B2:D4 raw values and
  displayed results before deletion, plus three outside-range controls. A
  single Undo must restore that actual snapshot. It no longer assumes the
  earlier formula test left D2 at its original seeded value. It also explicitly
  reselects B2:D4 before the invalid-address probe so inspection does not
  accidentally change the probe's precondition.
- Removed the Constraints reload criterion: Render tests reload; Constraints
  tests same-origin resources. A working-app browser prerequisite is retained.
- Removed the instruction sentence saying visual polish is not judged; the
  brief now asks for a readable, accessible, clear layout.

## What remains unchanged

All 20 Functional criterion IDs and their weights remain. The app's editing,
formula, session, persistence and conflict-safety requirements remain.
The final gate-then-60%-Functional/40%-Polish formula, judge/model configuration,
offline posture and timeout budgets are unchanged. Total GridForge criteria
are now 27: Render 2, Constraints 1, Functional 20, Polish 4.

There is no golden algorithm change for these fixes. Only its package version
was updated; dependency versions and lockfile integrity entries are unchanged.
PatchPad task files were not changed in this correction.

## Local validation

- Agent and verifier images build; real RewardKit discovery succeeds.
- Shell and JavaScript syntax checks pass; an empty submission scores zero.
- All six GridForge golden browser smoke groups pass, including a new ordered
  regression: D2 becomes =B2*(C2+10), displaying 390; name-box range deletion
  followed by one Undo restores all nine cells and outside-range controls,
  including D2=390 and its changed formula.
- Existing formula, dependency, circular-reference/Undo, UI save/reload,
  forged-user rejection, same-origin and page-error smoke tests still pass.
- Task ZIP is regenerated with LF text, executable shell-entry metadata,
  task-only contents and source hashes in structural-checks.json.

The alternate seeded-user entry UI and alternate fill-handle implementation
are accepted by the revised wording; no separate alternate implementation was
built or graded. Full Luna-driven Oracle and platform QC reruns remain pending.
Upload the 2.0.1 ZIP for those checks before using it for model scoring.
