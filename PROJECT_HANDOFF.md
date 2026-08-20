# Model-Breaking WebDev Task Handoff

This repo is for building Harbor + RewardKit single-step web development
tasks that are solvable by the Oracle/golden solution but difficult for model
runs.

GitHub repo:

```text
https://github.com/Rayuga/model-beraking-prompts.git
```

Clone on another device:

```bash
git clone https://github.com/Rayuga/model-beraking-prompts.git
cd model-beraking-prompts
```

## Goal

We want tasks where:

- Oracle/golden run scores `1.0`.
- Model runs score below about `0.7`.
- The task uses the single-step Harbor layout.
- Instructions live in one agent-facing file: `instruction.md`.
- Verifiers live under `tests/rubric/browser/`.
- Criteria weights stay between `0.5` and `2.0`.
- Easy related checks are merged so they do not inflate model scores.
- Hard implementation details are tested in the verifier, not leaked too
  specifically in the instruction.

Important distinction:

- `instruction.md` is the product brief shown to the coding model.
- `tests/rubric/browser/browser.toml` and `prompt.md` are judge-facing.
- Attached docs, papers, and notes are context for us, not extra instructions
  to the model unless we intentionally encode them in `instruction.md`.

## Source Materials

### Kickstart Doc

Local file:

```text
Harbor + RewardKit — Team Kickstart.docx
```

Main lessons from it:

- A Harbor task is a folder with `task.toml`, `instruction.md`,
  `environment/`, `tests/`, and usually `solution/`.
- The running container uses reserved paths like `/app`, `/tests`,
  `/solution`, `/assets`, and `/logs/verifier`.
- We are using the single-step layout, not a `steps/` multi-step task.
- Oracle mode runs `solution/solve.sh`; model mode lets the coding agent build
  the app.
- If Oracle does not pass, model scores are not meaningful.
- `tests/test.sh` must always produce verifier reward output.
- RewardKit browser judging uses a browser agent and Playwright MCP.
- Criteria should test behavior in the running app, not just file existence.
- `APP_MANIFEST.md` is useful for start commands but must not be trusted as
  grading evidence by itself.

Official links referenced by the kickstart doc:

```text
https://www.harborframework.com/docs/tasks
https://www.harborframework.com/docs/rewardkit
https://www.harborframework.com/docs/rewardkit/judge
https://www.harborframework.com/docs/tasks/multi-step-tasks
```

### Medicare Sample

Folder:

```text
medicare-appointment/
```

This is the sample/reference task. We used it to understand expected Harbor
structure, especially:

- where `instruction.md` goes
- where the verifier lives
- how `task.toml` is shaped
- how the golden `solution/` is packaged
- how zip upload packages should look

### Shared Google Doc

Link shared in chat:

```text
https://docs.google.com/document/d/1zVRYljZnzzqEekPFxcWj9IFC8nt-qXifze4rUKERk4M/edit?tab=t.a1d0zxkymnop#heading=h.sb5x109kdtgu
```

Context from chat: this contained Medicare breaking points. We treated it as
guidance for what kinds of verifier failures matter, not as direct product
text to copy.

### Research Paper

Paper:

```text
https://arxiv.org/pdf/2603.04601
```

Title:

```text
Vibe Code Bench: Evaluating AI Models on End-to-End Web Application Development
```

Useful lessons for us:

- End-to-end web application building is much harder than isolated coding
  tasks.
- Browser workflows are a strong way to evaluate real product behavior.
- The benchmark is implementation-agnostic: it grades what the app does, not
  exactly how it is coded.
- Tested behavior must be supported by the spec. The verifier can check exact
  cases, but the instruction must fairly imply the feature.
- Self-testing matters; tasks should include behaviors that require real
  browser interaction, not only static code generation.
- Good tasks include edge cases, persistence, user workflows, and failure
  paths.

### Text Editor References

Links shared in chat:

```text
https://www.averylaird.com/programming/the%20text%20editor/2017/09/30/the-piece-table
https://www.catch22.net/tuts/neatpad/neatpad-overview/
https://dev.to/isaachagoel/you-dont-know-undoredo-4hol
```

What we took from them:

- Custom editors have hidden complexity around cursor movement, selections,
  undo grouping, and persistence.
- Undo/redo can be deeper than two simple stacks, but for our task we settled
  on a simpler product instruction and precise verifier checks.
- We should not over-explain implementation details in the instruction unless
  the feature is not a normal expectation.

## Repo Structure

Current important folders/files:

```text
patchpad-editor/
gridforge-spreadsheet/
medicare-appointment/
patchpad-editor.zip
gridforge-spreadsheet.zip
PatchPad_Editor_QC.xlsx
PatchPad_Editor_Run_QC.xlsx
GridForge_Spreadsheet_QC.xlsx
patchpad-editor_qc_findings.json
patchpad-editor_run_qc_findings.json
gridforge-spreadsheet_qc_findings.json
.qc_skill_tmp/
```

Important generated/local-only item:

```text
.qc_run_job_675826d6_022707/
```

That is only a temporary extraction of a model run zip. It is not required for
the task package.

## Standard Task Layout

Each task should look like:

```text
task-name/
  task.toml
  instruction.md
  environment/
    Dockerfile
    assets/
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
      package.json
      APP_MANIFEST.md
      public/
      src/
```

Upload zips should contain the task contents, not the parent folder unless the
portal expects otherwise. They should not include:

- `node_modules`
- SQLite database files
- logs
- `__pycache__`
- `.pyc`
- local server job files

## Task 1: PatchPad Editor

Folder:

```text
patchpad-editor/
```

Zip:

```text
patchpad-editor.zip
```

Product idea:

Build a browser-based custom text editor for long incident reports. It must be
from scratch, not a native textarea/contenteditable/editor library. It includes
long-document editing, selections, clipboard, undo/redo, multi-caret editing,
find/replace, revision history, and conflict-safe persistence.

Current rubric:

- 20 verifiers
- total weight `15.5`
- weights from `0.5` to `2.0`

Verifier list:

```text
1. app_loads_seed_document                         0.5
2. custom_editor_no_native_editing_surface         0.5
3. seed_status_and_noop_save                       0.5
4. edit_save_reload_and_dirty_reload               0.5
5. keyboard_navigation_and_home_end                0.5
6. backspace_delete_line_join                      0.5
7. selection_word_line_keyboard_replace            0.5
8. selection_autoscroll_mouse_keyboard             0.5
9. clipboard_shortcuts_external_internal           0.5
10. undo_contiguous_typing_group                   2.0
11. undo_separate_locations_and_redo_clear         0.5
12. undo_paste_cut_replace_atomic                  2.0
13. find_replace_current_and_all                   0.5
14. long_document_integrity_save_reload            0.5
15. revision_history_records_versions              1.5
16. two_tab_stale_save_ui_conflict                 0.5
17. direct_api_save_rejections                     0.5
18. multi_caret_alt_click                          2.0
19. visible_errors_and_discoverable_controls       0.5
20. server_persistence_not_browser_storage         0.5
```

Main PatchPad breakers:

- contiguous typing must undo as one group
- selected-word replacement by typing must undo atomically
- paste/cut/replace must behave as single undo units
- multi-caret typing/backspace/delete must work across all carets
- revision restore must become an unsaved draft and be undoable in one step
- stale tab save and forged API saves must be rejected server-side

PatchPad model run evidence:

- Old run artifact was `job-675826d6.zip`.
- It was a model run, not Oracle.
- Model was `openrouter/openai/gpt-5.6-sol`.
- Score was `0.8736`, with 28/32 old criteria passing.
- Failed old criteria:
  - `undo_contiguous_typing_group`
  - `undo_paste_cut_replace_atomic`
  - `revision_history_records_versions`
  - `multi_caret_alt_click`
- After compressing/upweighting, those same failures would roughly score around
  `0.516` if all other current checks passed.

PatchPad current status:

- Static QC report is clean except for missing fresh Oracle/model run artifacts.
- Golden was fixed for undo grouping and revision restore behavior.
- Need fresh Oracle run on current `patchpad-editor.zip`.

## Task 2: GridForge Spreadsheet

Folder:

```text
gridforge-spreadsheet/
```

Zip:

```text
gridforge-spreadsheet.zip
```

Product idea:

Build a browser-based custom spreadsheet engine for operations planning. It
must be from scratch, not a spreadsheet widget or calculation library. It
includes formula evaluation, dependency recalculation, range editing, fill,
sort/filter, undo/redo, saved revisions, and conflict-safe persistence.

Current rubric:

- 20 verifiers
- total weight `29.5`
- weights from `0.5` to `2.0`

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

Most likely GridForge breakers:

- real dependency graph recalculation after source cells change
- range functions that recalculate after source changes
- circular reference detection and recovery after fixing the cycle
- fill formulas with relative references
- sorting rows while preserving row integrity and formulas
- TSV/range operations undoing atomically
- stale save conflict across two tabs
- forged API save rejection on the server

GridForge current status:

- Rubric was compressed from 29 to 20 verifiers.
- `gridforge-spreadsheet.zip` was rebuilt and pushed.
- Existing `gridforge-spreadsheet_qc_findings.json` still mentions the older
  29-verifier QC pass; run QC again after the next Oracle/model runs.

## What We Learned

### Scoring Shape Matters

The old PatchPad rubric had too many separate easy checks. A model could pass
basic UI behavior and score too high even while missing the real hard parts.
Compressing easy related checks and upweighting the hard behaviors makes the
score more meaningful.

### Instructions Should Be Fair But Not Over-Specific

Good instruction:

```text
Implement undo and redo using visible controls and keyboard shortcuts.
```

Better for verifier:

```text
Type a contiguous word, press Undo once, and verify the whole word disappears.
```

We avoid leaking every exact verifier sequence in the instruction, but the
feature must still be reasonably implied by the product brief.

### Browser-Agent Verifiers Need Strict Action Protocols

RewardKit browser judging uses a browser agent, so loose criteria can pass if
the agent finds an alternate way to reach the same end state. For interaction
features, write verifier steps as exact required actions and make fallback
paths disallowed.

Example for mouse selection:

```text
Using only the mouse, double-click directly on a visible word in the custom
editor. Do not use keyboard shortcuts, DOM mutation, APIs, search boxes, or any
alternate selection path. If double-click does not visibly select exactly that
word, fail this criterion. Press Backspace and verify only that selected word is
removed.
```

Use the same pattern for triple-click line selection, mouse drag selection,
multi-caret placement, fill handles, sort/filter UI, and other interaction
behaviors. Each required sub-step should be explicit, and any failed sub-step
should fail the criterion.

### Verifiers Can Be Conjunctive

One verifier can test multiple related sub-behaviors. That helps prevent
scoring inflation. Example: clipboard verifier can include paste from outside,
copy inside, paste elsewhere, cut, and undo.

### Server-Side Checks Are Strong

Models often implement UI guards but forget direct API safety. Good verifiers
use in-page `fetch` probes for:

- stale base revision
- unknown document/workbook id
- mismatched URL/body id
- missing or invalid base revision
- missing workbook/document payload

### Undo Is A Reliable Breaker

Common failures:

- undo one character at a time after typing a word
- replacement typing not atomic
- paste/cut/range operations not atomic
- redo stack not cleared after a new edit
- restore revision not undoable
- multi-caret edits not grouped

### Custom Surfaces Are Hard

For PatchPad:

- no textarea
- no contenteditable
- no Monaco/CodeMirror/ProseMirror/etc.

For GridForge:

- no textarea as the grid
- no input per cell as the whole editing surface
- no contenteditable
- no Handsontable, AG Grid, Luckysheet, x-spreadsheet, HyperFormula, SheetJS as
  the calculation engine, or similar widget

### Golden Must Pass First

Do not chase model score until Oracle is `1.0`. If Oracle fails, fix the task,
golden, or verifier first.

## QC Skill

The extracted QC scripts are in:

```text
.qc_skill_tmp/
```

Useful commands:

```bash
python .qc_skill_tmp/run_inventory.py patchpad-editor
python .qc_skill_tmp/run_inventory.py gridforge-spreadsheet

python .qc_skill_tmp/build_report.py patchpad-editor_qc_findings.json -o PatchPad_Editor_QC.xlsx
python .qc_skill_tmp/audit_report.py PatchPad_Editor_QC.xlsx

python .qc_skill_tmp/build_report.py gridforge-spreadsheet_qc_findings.json -o GridForge_Spreadsheet_QC.xlsx
python .qc_skill_tmp/audit_report.py GridForge_Spreadsheet_QC.xlsx
```

For extracted run artifacts:

```bash
python .qc_skill_tmp/run_inventory.py <extracted-run-folder>
```

## Local Running

PatchPad:

```bash
cd patchpad-editor/solution/app
npm install
npm start
```

GridForge:

```bash
cd gridforge-spreadsheet/solution/app
npm install
npm start
```

Open:

```text
http://localhost:3000
```

If Windows says `npm` or `node` is not recognized, Node.js is not installed or
is not on PATH. Install Node.js or reopen the terminal after PATH is fixed.

## Upload / Run Checklist

Before upload:

1. Confirm `task.toml` parses.
2. Confirm `tests/rubric/browser/browser.toml` parses.
3. Confirm all criterion weights are between `0.5` and `2.0`.
4. Confirm no zero-weight criteria.
5. Confirm the zip does not contain `node_modules`, DB files, logs, caches, or
   `__pycache__`.
6. Confirm `tests/test.sh` and `solution/solve.sh` are executable in the zip.
7. Run Oracle.
8. If Oracle is not `1.0`, fix before running model trials.
9. Run model trials.
10. Target model score: below `0.7`.

## Current Next Steps

PatchPad:

1. Upload current `patchpad-editor.zip`.
2. Run Oracle.
3. If Oracle fails, inspect failed verifier reasoning.
4. If Oracle passes, run model trials and check whether compressed rubric keeps
   model score below `0.7`.

GridForge:

1. Upload current `gridforge-spreadsheet.zip`.
2. Run Oracle.
3. If Oracle fails, fix golden/verifier first.
4. If Oracle passes, run model trials.
5. Focus on formula dependency, circular reference recovery, fill relative refs,
   sort integrity, and forged API rejection failures.

## Git Notes

Recent important pushed commits:

```text
3dde7a7 Compress GridForge rubric
f00ac05 Add PatchPad run QC report
d39513a Refresh PatchPad QC report
6743094 Compress PatchPad rubric and fix undo grouping
```

Current remote:

```text
https://github.com/Rayuga/model-beraking-prompts.git
```

If you resume on another device, pull latest first:

```bash
git pull
```
