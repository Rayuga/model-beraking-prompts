# Colderwater strict candidate, 2 October 2026

Branch `task/colderwater-editor-strict`. This candidate replaces the 2 October custom-editor candidate (input `5da6c508…`, QC round r3 incomplete at 34 of 53 rows). Its purpose is to bring the GPT-5.6 Luna score into the 0.10–0.70 band; the 1 October candidate scored Oracle 1.0 and Luna 0.8564.

## What changed

| Area | Change |
|---|---|
| Brief notes | `ui.md`, `behaviour.md`, `overview.md`, `security.md` and one sentence of `integration.md` rewritten. New stated behaviour: same-line carets, selection replace and single-Undo paste, Undo restores the caret, self-containing replacement text, caret kept in view, single-line Tab indent, focus returns to the code, disabled Undo/Redo, unsaved marker, 390 px layout, Promise rejection message and line, output kept before a failure, Stop cancels pending work, live shared library, newer-revision notice. |
| Gates | Render gate shortened to a typed one-line program run twice. Surface gate now decided from listed DOM facts only. Saved-record gate no longer mentions response shape. |
| Functional | 23 → 38 criteria (total weight 54). Every binary criterion ends with a "Fails if" sentence. Stale save, time limit/Stop/supersession and the preview boundary were split into independent criteria. |
| Polish | 2 → 6 criteria. |
| Visual | 3 Likert criteria, anchors tightened. |
| Prompts | All five rewritten on the template structure, with the in-dimension gate that zeroes a static shell in each scored prompt. |
| Golden | Clipboard through native copy/cut/paste events, multi-caret insert on document offsets, caret reveal on both axes, find/replace relative to the caret, replace-current advance, live library polling with a newer-revision notice, focus return after Save, phone-width CSS, friendly refusal text for blocked evaluation, fixed bundle names. |

## r3 findings addressed

- Row 17: Tab with a selection inside one line now indents the line.
- Rows 31/33: Replace all criterion states exactly four matches.
- Row 28: stale-save refusal and draft retention are separate criteria.
- Row 32: the surface gate lists DOM facts and no longer asks how the editor was built.
- Row 30: the preview-boundary criterion has matching positive controls for the page's own fetch and library entry.
- Row 29: each scored prompt carries the gate that assigns 0 to every criterion for a blank or static app.

Rows 4, 25, 26 and 27 were only skimmed before this rewrite and need the new QC round.

## Scripted golden evidence

`run_golden.sh` rebuilds the bundle, installs it with the task's own `solve.sh` into a clean agent-image container, and drives Chromium from the verifier image in the app's network namespace (`http://localhost:3000`, no clipboard permissions). Results are in `results/`.

| Suite | Checks | Result |
|---|---|---|
| editor | 21 Functional | 21 pass |
| runtime | render gate + 10 Functional | 11 pass |
| persist | saved-record gate + 7 Functional, with a real process restart (PID 25 → 53) | all pass |
| polish | surface gate + 6 Polish | 7 pass |

All 3 gate criteria, 38 Functional criteria and 6 Polish criteria pass. The 3 Visual criteria are Likert and were inspected on `results/golden-1440.png` only.

## Not measured

- No configured judge run, so no Oracle score, no judge duration and no Luna score for this candidate. The last attempt to run the configured judge failed with `unrecognized_model` for `z-ai/glm-5.3-flashx` and HTTP 401 from the provider.
- No QC round yet on these bytes.
- The inherited `test.sh` restart/cleanup finding is unchanged and still needs a shared-template decision.

## QC round r2 and the fixes that followed

Round `qc/runs/coldwater-strict-2026-10-02-r2` (input `af036c0a`, 54 independent reviews) was BLOCKED: 29 Pass, 18 Fail, 2 Not exercised, 4 Note on the quality rows; 40 Pass, 1 Fail, 3 Note, 4 N-A on the deterministic rows. The fixes below are in the next candidate, frozen as `qc/runs/coldwater-strict-2026-10-02-r3`. No review has been run on those bytes yet.

| Finding (rows) | Fix |
|---|---|
| Browser-storage-only app passes persistence (29, 35, 39) | The saved-record gate and the restart criterion now clear the origin's browser storage before the readback. |
| Draft-retention criterion passes when every Save is accepted (30, 39, 42) | It now requires B's refused Save as its control. |
| Graded but not asked (4, 6, 27, 42) | `ui.md` now states Shift+Arrow selection, a keyboard way out of the editor, and that single-caret typing may undo in one step or per character. The Undo-caret criterion uses "Undo until gone", the unsaved criterion accepts absence as the clean state, and the output-kept criterion no longer requires an order. |
| Judge not told the health address (32, 48, 49) | Added to `tests/app_context.md`. |
| Asked but not graded (26) | New criteria `cw_interaction_starts_fresh_budget` and `cw_console_levels_in_order`; Undo/Redo keyboard shortcuts and controls are named in existing criteria; the preview fetch is also tried against a public address; Stop covers a timer, an interval and a Promise callback. |
| Double charging (28) | Undo legs removed from the same-line-carets criterion, the Redo-cleared point removed from Polish, reasons removed from the output-kept criterion, the unsaved clause removed from the newer-revision criterion. |
| Timing and missing control (30, 32) | Stop and supersession use four-second timers with a void-and-repeat rule; supersession first proves the delayed write happens. |
| Ambiguous bars (31, 33) | Colouring states one bar; a restart-tool error fails the criterion; formatting guards string contents, not quote style; "page unchanged" is scoped to title and library entry. |
| Golden gaps (18, 17 note) | `let`, `of`, `async`, `await`, `yield` and `static` are coloured as keywords, every identifier call is coloured as a function, and a reopened record starts with a clean Undo history. |
| Prompt wording (34, 38, deterministic) | The independent-scoring rule is back in all three scored prompts; the Visual prompt has the judge select a word and watch the caret; the 0 anchors are restored. |
| Notes (3, 37) | Spelling unified, "identities" replaced, fresh pages after restart. |

Not changed: the row 2 note on the voice of the six notes, and the preview self-navigation observation from row 17, which is unverified; `security.md` now says the preview must not be able to read anything over the network.

After these fixes the task has 1 render gate, 2 constraints gates, 40 Functional criteria (weight 56.5), 6 Polish and 3 Visual. The scripted golden passes all 49 gate, Functional and Polish checks with a real restart.
