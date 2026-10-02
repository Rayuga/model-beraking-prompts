# Consistency review, coldwater-strict-2026-10-02-r9 (quick)

Scope: frozen task at `.qc-cache/coldwater-strict-2026-10-02-r9/task`. Source reading only; nothing was run in a browser, no judge run, no Docker. Read: instruction.md, six environment/instructions notes, tests/app_context.md, five prompt.md, five judge.toml (all 51 criteria), custom-editor.js lines 1-70 and 1162-1179, and the toolbar and narrow-width rules of style.css.

Paths below are relative to the frozen task folder.

## Findings (7), by severity

### M1. Render gate states two bars
`tests/gates/render/judge.toml:23`

The body says the page "must show a workspace with a code editing area and areas for a preview and a console". The "Fails if" sentence lists only: blank or error page, no code editing area, typed word missing, no reload. The same line also says "This checks only that the app is running and its editor accepts typing".

Counterexample: an app whose console sits in a collapsed tab or drawer on load. The body fails it (all_pass gate, so the whole task is zeroed); the Fails-if sentence passes it. The three in-dimension gates (functional/polish/visual prompt.md:5) do not require these areas either.

Fix: pick one bar. Either drop "and areas for a preview and a console" from the body, or add "or no preview or console area is shown" to Fails-if. The first matches the stated intent of the gate.

### M2. cw_basic_run_output: "still shows the first sum" fails an app that keeps console history
`tests/scored/functional/judge.toml:218`

"Fails if ... the second Run still shows the first sum." The notes (behaviour.md:3) forbid carrying page content and variables into the next run; they never ask the console to be cleared on Run. An app that appends console output shows the first sum and the new sum after the second Run.

Counterexample: console shows "5" then "7" after the second Run; preview shows 7. Correct per the notes, but the Fails-if sentence can be read as failed.

Also the body requires "both must show the new sum" on the second Run, while Fails-if does not cover the new sum missing from the console on the second Run.

Fix: "Fails if, after the second Run, the preview does not show the new sum or the new sum is not in the app console. Console lines left from the first Run are not a failure."

### M3. cw_basic_run_output has no failure of its own, at top weight
`tests/scored/functional/judge.toml:213-219` (weight 2.0)

Each of its three failure conditions is also a failure in existing criteria:
- .js Run does not reach the preview: cw_run_starts_fresh_document (:263), cw_long_line_editing (:92), cw_js_format_semantics_and_undo (:191), plus every control run in the Stop, supersede and time-limit criteria.
- console.log line missing: cw_console_levels_in_order (:272), cw_html_preview (:227), cw_output_before_failure_kept (:254).
- second Run shows stale output: cw_long_line_editing (:92, "Run must show the changed tail output"), cw_run_starts_fresh_document (:263).

This is not an identical-outcome duplicate of any single criterion (cw_html_preview is .html mode, cw_error_message_and_line is failures, cw_console_levels is four levels and order), so I do not call it a strict double charge. But it adds 2.0 of weight, the highest tier, to a bug already charged roughly fifteen times, and it shares the highest weight with multi-caret, format and Stop.

Fix: keep it as the anchor for basic Run, at weight 1.0. Optionally drop the console half and leave console capture to cw_console_levels_in_order.

### L1. Basic Run is also charged in Polish
`tests/scored/polish/judge.toml:68` (cw_narrow_width_usable: "Run it and see its output in the preview and its console line"; "Fails if ... typing and Run do not work at this width") and `:32` (cw_controls_feedback_and_labels needs a Run that completes and one that throws).

With Run out of the gate (app_context.md:29), a broken Run now costs two of six Polish criteria as well as Functional. For cw_narrow_width_usable the Run step is the same outcome as cw_basic_run_output at a different viewport.

Fix: in cw_narrow_width_usable require only that the Run control can be reached and pressed and that the preview and console areas are reachable; leave output correctness to Functional.

### L2. cw_long_line_editing: Run step missing from Fails-if
`tests/scored/functional/judge.toml:92`

Body: "Run must show the changed tail output". Fails-if lists wrapping, tail not reachable, and damage to the line; not Run. app_context.md:29 resolves it in practice ("a criterion whose steps need a working Run fails"), but the criterion itself has two bars.

Fix: add "or if Run does not show the changed tail" to Fails-if, or drop the Run step (the read-back of the source already proves the edit).

### L3. Stale cross-references in the Functional prompt and one criterion
- `tests/scored/functional/prompt.md:26`: "Do not repeat the gate fixtures." The gate fixture is now one typed word; the sentence is a leftover and reads oddly beside cw_basic_run_output. Remove it.
- `tests/scored/functional/judge.toml:380` (cw_live_library_update): "The earlier saves in this session show that the library works at all" leans on other criteria, against prompt.md:9-10 ("evidence ... for that criterion", "Never carry a verdict across criteria"). Reword to "this criterion is only about already open tabs staying current".

### L4. Script-use rule differs between app_context and three prompts
`tests/app_context.md:26` allows script for "exactly two things". `tests/gates/render/prompt.md:5` and `tests/scored/polish/prompt.md:17` say no script changes at all; `tests/gates/constraints/prompt.md:5` allows only storage clearing; `tests/scored/functional/prompt.md:20` allows both. No criterion in the stricter dimensions needs the missing use, so there is no wrong verdict today, but the judge reads two rules in one prompt.

Fix: in render and polish add "this dimension needs neither of the two script uses in the application notes".

## Per check

1. Coverage both ways. Nothing in the changed parts is ungraded or over-graded. cw_basic_run_output maps to behaviour.md:3 and ui.md:17; the gate maps to overview.md:3. Not graded by any judge criterion: DB_PATH, start from a working directory outside /app, the symlink rule (integration.md:3, :9, :11), and "New drafts start empty or with a small example" (overview.md:3); the first three are not browser-observable and I did not check whether the harness covers them. No criterion grades something the notes never ask, apart from the reading in M2.
2. Double charging: M3, L1. No strict same-outcome duplicate with cw_html_preview, cw_console_levels_in_order, cw_run_starts_fresh_document or cw_error_message_and_line.
3. One bar: M1, M2, L2. Smaller, pre-existing: cw_block_indent_undo (:74) body requires Shift+Tab to outdent but Fails-if omits it; cw_error_message_and_line (:236) bundles line numbers and syntax-error draft preservation in one verdict.
4. Prompt consistency: gate wording is identical in functional/polish/visual prompt.md:5 and matches the render criterion apart from M1. No sentence left that makes Run part of a gate (render/prompt.md:5 says "Do not grade running code"; visual/prompt.md:12 says a failed Run does not lower a visual score; app_context.md:29 agrees). Health address agrees across integration.md:3, app_context.md:24 and judge.toml:326. Real-input wording agrees. Leftovers: L3, L4.
5. Grader machinery in public notes: none found. No criterion id, no mention of judge, gate, rubric or the restart tool in instruction.md or the six notes.
6. Two-row toolbar: no break found from source. Undo, Redo, Format document, Find, Next, Previous, Replace, Replace all are all still present with the same ids and visible labels (custom-editor.js:11-21); DOM order gives a sensible Tab order ahead of the editor; Undo and Redo start disabled (:1165-1166), which cw_controls_keyboard_and_focus exempts and cw_undo_redo_availability expects; the on-screen exit hint "Escape, then Tab leaves the editor" is shown while the editor has focus (:1174); Format returns focus (:92, :98, :102); rows wrap (style.css:9) and at 520 px and below inputs flex (style.css:42-44). One naming note: the label text "Replace" and the button "Replace" sit side by side, and criteria say "Replace current"; app_context.md:14 and "match by purpose" cover it. Not confirmed in a browser: actual wrapping at 390 px and focus rings on the toolbar buttons.
