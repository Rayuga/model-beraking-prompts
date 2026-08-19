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
- Sort and filter.
- Undo/redo.
- Revision history.
- Conflict-safe persistence with server-side save validation.

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

The rubric was compressed from 29 criteria to 20 criteria.

Current totals:

- 20 verifiers
- total raw weight `29.5`
- minimum weight `0.5`
- maximum weight `2.0`

Verifier list:

```text
1. workbook_load_custom_surface_status             0.5
2. custom_grid_no_spreadsheet_widget               2.0
3. save_reload_dirty_noop_persistence              0.5
4. keyboard_selection_clipboard_ranges             0.5
5. formula_bar_raw_formula_and_precedence          1.5
6. cell_reference_dependency_recalculation         2.0
7. range_functions_dependency_recalculation        2.0
8. formula_errors_and_cycle_recovery               2.0
9. tsv_range_paste_undo_redo_atomic                1.5
10. range_copy_cut_clear_undo_atomic               1.5
11. fill_numbers_and_formula_relative_refs         2.0
12. sort_preserves_rows_and_formulas               2.0
13. filter_hides_without_deleting_rows             1.0
14. long_grid_scroll_save_reload_integrity         0.5
15. undo_redo_separate_edits_and_redo_clear        1.5
16. formulas_save_reload_as_raw_and_values         1.5
17. revision_history_preview_restore_undo          1.5
18. two_tab_stale_save_conflict                    2.0
19. forged_save_identity_and_stale_rejections      2.0
20. api_rejects_invalid_revision_payloads          1.5
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

### 5. Sort Preserves Rows And Formulas

Verifier:

```text
sort_preserves_rows_and_formulas
```

Why it is hard:

- Sorting must move whole rows, not only one column.
- West/North/South must remain paired with the correct revenue/cost values.
- Row formulas must still evaluate correctly after sort.

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

## Instruction Strategy

Keep `instruction.md` clear and product-level:

- Say to implement formulas, ranges, fill, sort/filter, undo/redo, revision
  history, and conflict-safe persistence.
- Say the grid must be custom and not a spreadsheet widget.
- Say saves must include base revision and be enforced server-side.
- Do not list every exact verifier sequence in the instruction.

The verifier can then test exact cases:

- `=10/0`
- `=SUM(`
- `H3 = H4` and `H4 = H3`
- TSV paste into `J2:L4`
- fill `M2:M7`
- sort `A9:D12`
- forged save payloads

## Dos

- Keep verifiers behavioral and browser/API based.
- Use direct API probes for server-enforced rules.
- Merge easy related checks.
- Weight model-breaking spreadsheet logic at `2.0`.
- Keep simple UI/persistence checks at `0.5`.
- Rebuild `gridforge-spreadsheet.zip` after task/rubric changes.
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

The existing GridForge QC report predates the compression from 29 to 20
verifiers, so rerun QC after fresh Oracle/model artifacts are available.

## Next Steps

1. Upload current `gridforge-spreadsheet.zip`.
2. Run Oracle.
3. If Oracle fails, fix the golden or verifier first.
4. If Oracle passes, run model trials.
5. Inspect which hard criteria fail.
6. Target: Oracle `1.0`, model score below `0.7`.
