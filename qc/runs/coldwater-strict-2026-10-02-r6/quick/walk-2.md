# walk-2: golden vs. literal judge, editor find/replace/colour/format criteria (r6)

Frozen task: `.qc-cache/coldwater-strict-2026-10-02-r6/task`. Static trace only: nothing was run, and Prettier output was reasoned, not executed (no `node_modules` in the frozen solution).

Result: 0 GOLDEN FAILS, 0 NOT ACHIEVABLE, 4 AMBIGUOUS (all low).

## Problems

### 1. cw_replace_all_atomic - AMBIGUOUS (low)
- Sentence: "type one new character and then try the visible Redo control again: it must be unavailable or do nothing".
- Golden: `solution/app/src/custom-editor.js:1162` (`redo-btn.disabled = state.redo.length === 0`), after `pushGroupedUndo` clears redo at :223.
- Observation: Redo is a disabled button. A Playwright MCP click on a disabled button waits for "enabled" and times out as a tool error. prompt.md says "If a browser tool errors, retry once, then fail that criterion". A judge that reads the snapshot sees `[disabled]` and passes; one that literally "tries" the click may fail on the tool-error rule.
- Fix: add to the criterion "a disabled Redo control counts as unavailable; do not click it".

### 2. cw_format_error_keeps_draft - AMBIGUOUS (low)
- Sentence: "First format a small valid JavaScript draft and see it change" / "Fails ... if the valid control did not format".
- Golden: `custom-editor.js:88` (returns "Already formatted." with no change when the text already equals Prettier output).
- Observation: a judge whose control draft is already tidy (`const a = 1;`) sees no change and fails the control.
- Fix: say "a compact draft that is not yet formatted, for example `const a=1;let b=2;`".

### 3. cw_format_error_keeps_draft - AMBIGUOUS (low)
- Sentence: "a clear syntax error (for example a missing closing brace)".
- Golden: `custom-editor.js:82-85` (Prettier babel parser, which recovers from some early errors).
- Observation: a missing brace, bracket or parenthesis throws and gives "Format failed, draft unchanged: ...". A judge that instead picks a duplicate `const` declaration or a `return` outside a function may get a successful format, because Prettier's babel parser tolerates those; the draft changes and no failure message appears.
- Fix: make it "an unclosed brace, bracket or parenthesis" instead of an example.

### 4. cw_html_format_semantics_and_undo - AMBIGUOUS (low, unverified)
- Sentence: "A second Format must leave the text identical" / "consistent two-space nesting".
- Golden: `custom-editor.js:84` (plugins are babel, estree and html only; no postcss).
- Observation: if the judge's fixture adds a `<style>` block, its CSS cannot be formatted by an embedded parser and is carried through as written. If it puts an inline element directly against a comment or another inline element with no space, Prettier emits hanging `><` line breaks that a literal judge may read as inconsistent nesting. Neither is required by the criterion; I could not execute Prettier to confirm either output or its idempotence.
- Fix: run the golden once on a fixture with `<style>` and adjacent inline elements; if unstable, add the postcss plugin or name a block-level fixture shape in the criterion.

## Traced clean (no problem found)

- cw_same_line_carets: offsets-based insert (:588-606) and merged backward deletes (:676-720) give `alphaX betaX gammaX` after two characters and one Backspace. Modifier-click toggling at :360-374.
- cw_undo_restores_caret: first marker is one typing group whose snapshot holds the mid-line caret (:571-576); Ctrl+End ends the group (:772); two Undos restore source and caret; the Undo button refocuses the editor (:61). Enter is a one-character insert, so a typed fixture is itself one group and does not get in the way.
- cw_find_forward_backward_wrap: `indexOf` literal, case-sensitive (:981); Next from selection end, wraps to 0 (:1023-1025); Previous from selection start, wraps to last (:1038-1043); match becomes selection and caret (:996-1007).
- cw_replace_current: active match derived from live selection (:988-993); moves to the following original (:1070); one snapshot per replace, so one Undo and one Redo.
- cw_replace_self_containing_text: split/join (:1088) gives exactly three; second Replace current starts from the reselected second original, not the inserted text.
- cw_js_semantic_coloring: keyword #c792ea, function #82aaff weight 600 (declaration and call, :134-139), string #c3e88d, number #f7ae72, comment #8296aa italic, plain #d8e5f3 (`style.css:13,24-28`). All six differ.
- cw_html_semantic_coloring: tag #f07178, attribute #ffcb6b, value #c3e88d, comment #8296aa italic (`style.css:26,28-30`). An `=` inside a quoted value stays string-coloured because the string token sorts first (:181, :1227).
- cw_js_format_semantics_and_undo: one `pushUndo` per format (:89); second format hits the "Already formatted" branch; trailing newline stripped at :87.
- `.section-heading` (:1115-1118) has no CSS rule, so capitalised fixture lines are unaffected.
- Coordinate and modifier clicks need `browser_run_code`; the pinned `@playwright/mcp@0.0.79` (tests/Dockerfile:19) should provide it without `--caps=vision`. Not verified live.
