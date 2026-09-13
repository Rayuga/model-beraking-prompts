# PatchPad Astra/high review — 2026-09-12

Scope: review the latest two Oracle functional failures and validate proposed smaller procedures. Two independent read-only reviews used `gpt-6-astra` with high reasoning. No task source, golden solution, scoring weights, criteria, historical evidence or ZIP was changed. No paid Oracle/model/QC judge was invoked.

## Findings

1. `selection_autoscroll_exact_offscreen_range`: the current mouse leg requires a copied range beginning at the full ALPHA-0010 line and including ALPHA-0060. Only the keyboard leg demands the exact ending. The Oracle explanation calls the mouse drag an overshoot and refers to "both exact legs"; overshoot alone does not violate the mouse requirement. The exported explanation lacks a full action trace, so it cannot exclude a wrong anchor, whole-document selection or another legitimate failure.
2. `multi_caret_backspace_delete_sibling`: the unchanged golden passes the required three-caret operation with verified positions. In an actual browser, carets at offsets 0, 8 and 7 on the three target lines reproduce the exact reported bad strings: `imeline`, `Customerimpact`, `Action tems`. Carets at 0, 0 and 0 instead produce the required `imeline`, `ustomer impact`, `ction items`. This supports a targeting/setup problem, not a demonstrated deletion-transform bug. It does not reconstruct the missing judge action trace.
3. Shortening the selection alone is not sufficient: both mouse and keyboard must still start with the target outside the viewport. Making both endpoints visible would remove coverage of a stated requirement.

## Fresh local checks

Final invocation of `browser.cjs`: **9/9 diagnostic groups passed** at 1280x800 in real headless Chromium:

- Original three-caret Backspace, Delete and individual Undo: three independent fresh-page repeats, with rendered caret-position readback and whole-document equality after each Undo; reload discards unsaved changes.
- Original 51-line mouse and keyboard offscreen selections: three repeats, newly revealed content, real selection-driven scrolling, real clipboard copy, exact keyboard slice, visible final keyboard caret, unchanged full document. Each mouse run selected 51 lines and scrolled 1092 pixels.
- Deliberately wrong caret positions reproduced the exported bad Delete text exactly. This is a successful diagnostic reproduction, not an application-feature pass.
- Proposed adjacent two-caret Backspace/Delete sample: both exact results, both individual Undos, and unchanged non-target document content.
- Proposed four-line offscreen selection sample: ALPHA-0010 through ALPHA-0013, independently verified initial offscreen geometry for each input path, actual scrolling, exact keyboard copy and unchanged document. The mouse test deliberately continued beyond the target, demonstrating the permitted contiguous superset; the keyboard endpoint stayed exact.

Other fresh checks:

- **118/118 repository standard checks** passed: 2 Render, 2 Constraints, 27 Functional, 3 Polish, 5 Visual (39 criteria).
- `bash -n`: solution/solve.sh, tests/test.sh, tests/app-lifecycle.sh.
- `node --check`: app/public/js/app.js, app/src/index.js, app/src/db.js.
- Golden installation and seed startup in disposable `/app`, HTTP readiness before browser work.
- All three executed JavaScript files byte-match the read-only source after setup.
- Existing ZIP: 32 file entries, one `patchpad-editor-v2/` prefix, every archived file hash matches current source.

Execution used cached `patchpad-preflight-tests:2.0.9` with `--network none` solely to isolate local diagnostics. This did not alter the task's agent/verifier public-network configuration. The Windows Python alias could not execute under the sandbox; the structural checker ran successfully using Python inside the cached offline container.

Evidence: `results.json`, `structural-checks.json`, and reproducible `browser.cjs` in this folder. Source mounts were read-only; the server and database lived in an automatically removed container. Existing user preview containers were left untouched.

## Recommendation before another upload

Clarify the two procedures, not their scoring:

- State explicitly that a mouse range continuing past the target is valid when it has the correct anchor, contiguous document text, the target, and actual selection-driven scrolling. Keep the keyboard's exact endpoint requirement separate.
- Verify every rendered caret's requested boundary immediately before the deletion key, not just the status label for the primary caret. Re-measure glyph starts after scrolling or layout changes. Do not call an unverified setup a correctly executed app failure.
- If the requested sample reduction is adopted, use four lines across a genuine viewport boundary and two adjacent visible carets for the deletion sibling. Preserve both selection input paths, both deletion keys, exact Undo checks, current ids and weights, and the independent three-caret typing/Undo/Redo criterion. This retains stated feature coverage while reducing sample breadth; it is not identical to the original tests.
- Keep shared working-content gates and the custom-editor constraint unchanged. Do not remove the two criteria or add easier criteria to inflate the score.

No new source release or ZIP has been prepared by this review. The current ZIP remains:

`deliverables/patchpad-editor-v2/1.0.0-working-content-gate/patchpad-editor-v2.zip`

SHA-256: `008124889f3191faef12cd077c4b702b670f295d299cda31d3c3778e2206c92d`

## Limits and remaining risks

This is targeted local verification, not a complete platform rubric audit or a completed Oracle run. No fresh exact-Dockerfile build, all-39-criteria run, restart-persistence suite, server-rejection suite or paid platform judge was run in this review. Existing source and archive were not modified, so these tests do not validate a hypothetical revised package. The latest historical Oracle result remains 0.9566 overall / 0.9277 Functional; it is not a new result from this review.

Browser-tool latency, focus, clipboard completion and judge interpretation can still cause failures. The app's autoscroll is fast (28 pixels every 35 ms), so mouse endpoint tolerance matters more than merely reducing the distance. The golden's boundary-scroll helper maps horizontal position to line start/end; this implementation limitation was noted but did not fail these tests and was not changed. Wrapped-line implementations also need logical-line-aware setup. A platform Oracle 1.0 and all rubric passes cannot be guaranteed from local diagnostics.
