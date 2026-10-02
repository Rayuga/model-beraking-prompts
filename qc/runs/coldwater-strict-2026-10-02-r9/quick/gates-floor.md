# Gates and floor quick review: coldwater-strict-2026-10-02-r9

Scope: frozen task `.qc-cache/coldwater-strict-2026-10-02-r9/task`, source reading only. Nothing was run; every score below is an estimate from the criterion text, not a measured judge result.

Paths are relative to `task/tests/`.

## 1. Can trivial submissions pass both gates?

| Submission | Render gate | Constraints gate | Stopped by |
|---|---|---|---|
| Blank page | Fails: "page is blank or shows only an error" (`gates/render/judge.toml:23`, `gates/render/prompt.md:5`) | not reached in effect | render |
| No-op (no server) | Fails: unavailable server (`gates/render/prompt.md:5`) | fails too | render |
| Static HTML shell | Fails: typed word must appear in the editor (`gates/render/judge.toml:23`) | fails Save (`gates/constraints/judge.toml:32`) | render |
| Plain textarea (or contenteditable, or CodeMirror/Monaco) | Passes: the word appears and the page reloads | Fails `cw_custom_document_surface` (`gates/constraints/judge.toml:23`) | constraints |
| Custom editor, snippets kept only in localStorage | Passes | Fails `cw_shared_saved_record` after the storage clear (`gates/constraints/judge.toml:32`) | constraints |

Both gates use `all_pass` (`gates/render/judge.toml:15`, `gates/constraints/judge.toml:15`) and `score.py:41` requires each gate score to be above 0.0, so none of the four passes both.

## 2. Weakest app that passes both gates

A page with three labelled areas (editor, preview, console), a div-drawn editor that appends typed characters, title and filename fields, a Save button that posts to a file-backed server and reports success, and a library list that reopens a record. No Run, no Undo, no Find, no Format, no history.

Functional (42 criteria, total weight 59.5):

- Every editor criterion fails: each needs Undo, caret navigation, selection, multi-caret, Find, Format or colouring (`scored/functional/judge.toml:24-209`).
- Every Run criterion fails (`:213-335`).
- `cw_save_reload_restart` (1.5, `:339-344`) is the only plausible pass, and only if the app also has New and shows a revision and history; otherwise it fails too.
- Stale-save, history and live-update criteria fail (`:348-398`).
- Estimate: 0 to 1.5 of 59.5, so Functional is 0.000 to 0.025.

Polish (6 binary, equal weight, `scored/polish/judge.toml`):

- `cw_controls_keyboard_and_focus` (`:23`): likely pass, because absent controls are "scored elsewhere, not here" and native buttons are focusable.
- The other five fail: they need Run, Format, Undo/Redo controls or an unsaved marker that clears on Undo (`:32, :41, :50, :59, :68`).
- Estimate: 0.17.

Visual (3 likert, `scored/visual/judge.toml`): about 3 of 5 each if modestly styled, so 0.6; up to 1.0 if well styled.

Reward: the weighted score would be about 0.6*0.025 + 0.2*0.17 + 0.2*0.6 = 0.17, but Functional 0.025 is not above the 0.05 floor (`scoring.toml:10-11`, `score.py:47-48`), so the reward is 0.0. That is acceptably low.

Floor reachability: the floor needs more than 2.975 of 59.5, which means at least 3.0 weight. The thin app cannot reach it. The cheapest crossing is two 1.5-weight criteria, for example `cw_save_reload_restart` plus `cw_stale_save_refused` (3.0/59.5 = 0.0504), or `cw_basic_run_output` (2.0) plus any 1.0 criterion. An app sitting just over the floor with a clean UI would earn about 0.03 + 0.03 + 0.12 to 0.20 = 0.18 to 0.26, nearly all of it from Visual. See problem P1.

## 3. Consistency of the in-dimension gate sentence

- The three scored prompts carry the same sentence: loads without a fatal error and typed text appears in the code editor, else 0 for every criterion (`scored/functional/prompt.md:5`, `scored/polish/prompt.md:5`, `scored/visual/prompt.md:5`). It matches the render gate (`gates/render/judge.toml:23`). None mentions Run.
- `app_context.md:29` says Run may be broken and that criteria not needing Run are still scored. Consistent.
- `scored/visual/prompt.md:12` asks the judge to Run a draft once but says a failed Run is not a reason to lower a visual score. Consistent.
- No prompt or criterion makes Run a dimension-wide precondition. Run-dependent criteria fail individually, which is correct.
- Small wording leftovers:
  - `scored/polish/prompt.md:1` says "how the working app behaves", which is harmless.
  - `scored/functional/prompt.md:26` says "Do not repeat the gate fixtures". With the Run fixture gone from the gate, this now refers only to a typed word; a judge could read it as a reason to skip the save steps that overlap the constraints gate. Low risk, see P3.
- `gates/render/judge.toml:23` requires "areas for a preview and a console" while `gates/render/prompt.md:5` calls it a reachability gate only. An otherwise strong app that hides the console in a tab until first Run could be zeroed. See P2.

## 4. Easy Polish or Visual credit when Run is broken

- Polish: `cw_controls_feedback_and_labels` and `cw_narrow_width_usable` need Run and fail. The other four do not need Run and pass on their own merits, which is legitimate and not a false pass.
- `cw_controls_keyboard_and_focus` (`scored/polish/judge.toml:23`) is the one lenient criterion: an app with very few controls passes because missing controls are not counted. That is worth at most 0.2/6 = 0.033 of reward and is behind the floor. Acceptable; noted as P4.
- Visual: all three criteria can score 5 with Run broken (the preview and console are empty but laid out). That is 0.2 of reward for an app with no working Run. It is by design (`scored/visual/prompt.md:12`), and such an app still loses about 25.5 of 59.5 Functional weight. No false pass, but it feeds P1.
- An otherwise complete app with broken Run would land near 0.6*0.57 + 0.2*0.67 + 0.2*1.0 = 0.68. That ordering is sensible.

## 5. Row verdicts

| Row | Verdict | Reason |
|---|---|---|
| 7 | Pass | The smallest submission satisfying the gates scores 0; the criteria demand a real editor, sandboxed Run and server revisions. |
| 29 | Pass | The gate dimensions hold the hard gate and all three scored prompts restate the same zeroing sentence (`prompt.md:5` in each); no same-origin demand. |
| 35 | Pass | Run is proven by `cw_basic_run_output` (weight 2.0); durability by the constraints gate and `cw_save_reload_restart` with a real restart. |
| 39 | Pass | Blank, static shell, textarea, no-op and refuse-everything all fail a gate and earn 0. |
| 40 | Pass | 42 weighted Functional criteria across editor, Run and persistence; Run is no longer a single precondition for everything. |
| 42 | Pass, with note | No inversion found; Functional carries 0.6. P2 is a small risk that a stronger app fails the render gate on layout. |
| 43 | Pass, with note | Gates are 0.0 and carry no weight (`scoring.toml:1-3`); `score.py:41-48` zeroes on gate or floor failure. P1: just over the floor, Visual dominates. |

## Problems and fixes

- P1 (low): an app just over the 0.05 floor can earn about 0.2 mostly from Visual. Fix: none needed if the floor is template-controlled; otherwise record it as accepted, since 3.0 Functional weight needs two real server or Run behaviours.
- P2 (low): the render gate requires visible preview and console areas, which goes beyond reachability. Fix: say "a workspace with a code editing area" and leave preview and console to Functional, or add "an area reachable by a tab or toggle counts".
- P3 (low): "Do not repeat the gate fixtures" in `scored/functional/prompt.md:26` is stale. Fix: delete that sentence or say "the typing check of the gate above need not be repeated per criterion".
- P4 (info): `cw_controls_keyboard_and_focus` passes for an app with few controls. Fix: optional; require that at least Run, Save and the library exist and are reachable.
