# GridForge Spreadsheet Context

GridForge is the spreadsheet-engine task in this repo. It is meant to be a
complex browser-based webdev challenge, not a CRUD dashboard.

## What We Are Trying To Achieve

Target behavior:

- Oracle/golden solution should score `1.0`.
- Model runs should ideally score below `0.7`.
- The task should be fair: every verifier should be supported by
  `instruction.md`.
- The task should still be difficult: exact edge cases live in
  `tests/rubric/browser/browser.toml`, not over-explained in the instruction.
- Verifier weights must stay between `0.5` and `2.0`.
- Easy checks are merged so passing surface-level UI does not inflate score.

## Product Shape

GridForge asks the agent to build a custom spreadsheet app for operations
planning.

Core requirements:

- Browser-based Node.js app.
- SQLite as system of record.
- Seed workbook from `/assets/workbook_seed.json`.
- Workbook title: `Northwind Operations Plan`.
- Sheet name: `Plan`.
- Custom grid surface built from scratch.
- Formula evaluation and dependency recalculation.
- Range selection/editing, copy, cut, paste, clear, fill.
- Find/replace and name-box navigation.
- Undo/redo.
- Revision history.
- Conflict-safe persistence with server-side save validation.
- Seeded-user login, per-cell attribution, selected-cell history, and
  cell-level merge/conflict handling for concurrent saves.
- Google-Sheets-style autosave after the user pauses editing, while still
  preserving explicit revision history.

## Important File Map

```text
gridforge-spreadsheet/
  instruction.md
  task.toml
  CONTEXT.md
  environment/
    Dockerfile
    assets/
      workbook_seed.json
  tests/
    test.sh
    test.py
    rubric/
      browser/
        browser.toml
        prompt.md
  solution/
    solve.sh
    app/
      APP_MANIFEST.md
      package.json
      public/
      src/
```

Upload package:

```text
gridforge-spreadsheet.zip
```

## Current Rubric Shape

The rubric was compressed from 29 criteria to 20 criteria, then expanded with
two dedicated live-collaboration criteria.

Current totals:

- 22 verifiers
- total raw weight `32.0`
- minimum weight `0.5`
- maximum weight `2.0`

Verifier list:

```text
1. workbook_load_custom_surface_status             0.5
2. custom_grid_no_spreadsheet_widget               2.0
3. autosave_reload_revision_attribution           0.5
4. keyboard_mouse_range_selection                  0.5
5. formula_bar_raw_formula_and_precedence          1.5
6. cell_reference_dependency_recalculation         2.0
7. range_functions_dependency_recalculation        2.0
8. formula_errors_and_cycle_recovery               2.0
9. tsv_csv_range_paste_undo_redo_atomic            1.5
10. range_copy_cut_clear_undo_atomic               1.5
11. fill_numbers_and_formula_relative_refs         2.0
12. find_replace_navigation_atomic                 1.5
13. name_box_jump_and_range_selection              1.0
14. long_grid_scroll_save_reload_integrity         0.5
15. undo_redo_separate_edits_and_redo_clear        1.5
16. formulas_save_reload_as_raw_and_values         1.0
17. revision_history_preview_restore_undo          1.5
18. two_tab_stale_save_conflict                    2.0
19. live_presence_and_clean_tab_updates            1.5
20. live_remote_selection_boundaries_and_legend    2.0
21. forged_save_identity_and_stale_rejections      2.0
22. api_rejects_invalid_revision_payloads          1.5
```

## Most Important Breakers

### 1. Formula Errors And Cycle Recovery

Verifier:

```text
formula_errors_and_cycle_recovery
```

Why it is hard:

- `=10/0` must show a visible error, not `Infinity`.
- Invalid formulas such as `=SUM(` must show an error without breaking the app.
- Circular references such as `H3 = H4` and `H4 = H3` must be detected.
- After fixing the cycle by setting `H4` to `12`, `H3` must recover and
  recalculate to `12`.

This is probably the single hardest verifier because it requires parsing,
dependency tracking, cycle detection, error state management, and recovery.

### 2. Dependency Recalculation

Verifier:

```text
cell_reference_dependency_recalculation
```

Why it is hard:

- The app must not just calculate formulas once.
- When `B2` changes, seeded formula `D2` and user formula `G4` must update
  immediately.
- Many model solutions miss a real dependency graph or recompute only the
  edited cell.

### 3. Range Function Recalculation

Verifier:

```text
range_functions_dependency_recalculation
```

Why it is hard:

- Must support `SUM`, `AVG`, `MIN`, `MAX`, and `COUNT`.
- Must parse ranges like `B2:B4`.
- Must recommend a matching function while the user types a formula.
- Must let the user mouse-drag a grid range into the formula being edited.
- Must visibly outline referenced cells or ranges while the formula is being
  edited.
- Must handle comma-separated function inputs such as `SUM(B2:B4,C2)`.
- Must recalculate every dependent range formula after a source value changes.

### 4. Fill Relative Formula References

Verifier:

```text
fill_numbers_and_formula_relative_refs
```

Why it is hard:

- Number fill must infer `1, 2, 3, 4, 5, 6`.
- Formula fill must convert `=B2*C2` in `N2` into row-relative formulas in
  `N3` and `N4`.
- Many simple implementations copy the literal formula, which fails.

### 5. Find/Replace And Name-Box Navigation

Verifiers:

```text
find_replace_navigation_atomic
name_box_jump_and_range_selection
```

Why it is hard:

- Find Next must advance through matches instead of staying on the first hit.
- Replace one match and Replace All must affect the exact expected cells.
- Replace All must undo atomically.
- The name box must jump to distant cells, select rectangular ranges, and
  reject invalid addresses without changing the current range.

Note: sort/filter were removed because the UI was becoming too custom and not
worth carrying into the task.

### 6. Server-Side Save Rejections

Verifiers:

```text
two_tab_stale_save_conflict
forged_save_identity_and_stale_rejections
api_rejects_invalid_revision_payloads
```

Why they are hard:

- UI-only disabled buttons are not enough.
- Direct in-page `fetch` calls must be rejected by the server.
- Stale `baseRevision`, unknown workbook id, mismatched workbook id, missing
  revision, non-integer revision, and missing workbook data must not create
  revisions or alter stored data.

### 7. Cell-Level Collaboration Semantics

Features now implemented in the golden:

- Seeded users come from `workbook_seed.json`: Riley Stone, Morgan Lee, and
  Priya Shah.
- The UI has a user selector so saves are attributed to the current user.
- The server stores per-cell history with old value, new value, user, revision,
  and timestamp.
- Selecting a cell shows who last edited it and the cell's recent history.
- If two users save from the same base revision but changed different cells, the
  server merges both edits.
- If two users save from the same base revision and changed the same cell, the
  later save is rejected with the conflicting cell address.

Good exact verifier shape:

```text
Load revision 1 in two tabs. In tab A as Riley, set B2 to 41 and save. In tab B
as Morgan, without reloading, set C2 to 19 and save. Reload the workbook and
verify B2 displays 41 and C2 displays 19.

Then from the same old base revision, try to save B2 as PRIYA-B2 as Priya.
Verify the response or UI conflict names B2, reload the workbook, and verify B2
still displays 41.
```

### 8. Autosave Persistence

Feature now implemented in the golden:

- Any edit marks the workbook dirty and schedules an autosave after a short
  pause.
- The status label can show Dirty, Saving, Saved, or Save failed.
- Manual Save remains as a "save now" control.
- Autosaved edits create revisions and cell-history entries just like manual
  saves.

Good exact verifier shape:

```text
Select Riley Stone. Set B2 to AUTOSAVE-B2 through the grid UI. Do not press
Save. Wait until the UI shows Saved, then reload. Verify B2 displays
AUTOSAVE-B2. Select B2 and verify cell history shows Riley Stone, old value 3,
and new value AUTOSAVE-B2.
```

## Instruction Strategy

Keep `instruction.md` clear and product-level:

- Say to implement formulas, ranges, fill, find/replace, name-box navigation,
  undo/redo, revision
  history, and conflict-safe persistence.
- Say the grid must be custom and not a spreadsheet widget.
- Say saves must include base revision and be enforced server-side.
- Do not list every exact verifier sequence in the instruction.

The verifier can then test exact cases:

- `=10/0`
- `=SUM(`
- 4-cell dependency loop `H4 -> H5 -> H6 -> H7 -> H4`
- TSV paste into `J2:L4`
- fill `M2:M7`
- find/replace `target -> DONE`
- name-box entries such as `T80`, `B2:D4`, and `BADREF`
- forged save payloads

## Verifier Strictness Learning

From the PatchPad model run, we learned that a browser-agent judge may satisfy
the final state through a different route if the criterion is too loose. For
GridForge, interaction-specific criteria should lock the action path:

- If testing mouse range selection, require real mouse down/drag/up and fail if
  the judge has to use formula-bar shortcuts, DOM mutation, or API writes.
- If testing keyboard navigation, require real Arrow/Tab/Enter key presses
  after focusing the custom grid.
- If testing TSV paste, require real clipboard paste into the grid.
- If testing fill, require the app's visible fill handle/control, not manual
  typing of the target cells.
- If testing find/replace or name-box navigation, require the visible app
  controls, not direct data mutation.
- If testing stale or forged saves, require direct in-page `fetch` probes from
  the app origin and re-read stored data after each rejected write.

Rule of thumb: if the named interaction does not work, the criterion should
fail instead of allowing the verifier agent to reach the same final state by
another route.

## Dos

- Keep verifiers behavioral and browser/API based.
- Use direct API probes for server-enforced rules.
- Merge easy related checks.
- Weight model-breaking spreadsheet logic at `2.0`.
- Keep simple UI/persistence checks at `0.5`.
- Rebuild `gridforge-spreadsheet.zip` before upload or Oracle runs, not after
  every tiny verifier wording edit.
- Run Oracle before trusting model scores.

## Don'ts

- Do not rely only on `APP_MANIFEST.md` as grading proof.
- Do not overfit the instruction with exact hidden test values.
- Do not let easy UI checks dominate total score.
- Do not accept UI-only conflict handling.
- Do not include `node_modules`, DB files, logs, caches, or `__pycache__` in
  the upload zip.
- Do not trust model results if Oracle is failing.

## Local Run

```bash
cd gridforge-spreadsheet/solution/app
npm install
npm start
```

Open:

```text
http://localhost:3000
```

If `npm` or `node` is not recognized on Windows, install Node.js or fix PATH and
reopen the terminal.

## QC Commands

From repo root:

```bash
python .qc_skill_tmp/run_inventory.py gridforge-spreadsheet
python .qc_skill_tmp/build_report.py gridforge-spreadsheet_qc_findings.json -o GridForge_Spreadsheet_QC.xlsx
python .qc_skill_tmp/audit_report.py GridForge_Spreadsheet_QC.xlsx
```

The current pre-Oracle QC findings are recorded in
`gridforge-spreadsheet_qc_findings.json`. Run QC again after fresh Oracle and
model artifacts are available.

## Next Steps

1. Resolve the remaining open pre-Oracle QC alignment and coverage findings.
2. Rebuild and inspect `gridforge-spreadsheet.zip` immediately before upload.
3. Run Oracle and require a score of `1.0`.
4. If Oracle fails, fix the golden or verifier first.
5. If Oracle passes, run model trials and target a representative score below
   `0.7`.
6. Repeat QC against the Oracle and model job folders.
