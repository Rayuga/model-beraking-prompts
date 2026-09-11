# PatchPad 2.0.16 — Oracle run 61fd1cd1 diagnosis

Reviewed 2026-09-11. Diagnostic evidence only; no task source, criteria, weights,
release ZIP, or historical reports changed. No paid calls or platform runs made.

## Platform result

- Oracle trial: `run-61fd1cd1-b364-4b0c-9460-6b1459a59f3f/patchpad-editor-v2__Arwo2BX`.
- Overall 0.7614; Functional 0.7349; Render, Constraints, Polish each 1.0.
- All seven exported golden app files match current `solution/app` byte-for-byte,
  including package version 2.0.16. This establishes app identity, not a full
  revalidation of every uploaded task file.
- Five failed Functional criteria have total weight 5.5 out of 20.75.
- Judge: Codex, `gpt-5.6-luna`. No trial-level infrastructure exception recorded.
- The exported reward details contain reasons but no usable browser-action
  trajectory; exact failing judge scripts and mouse endpoints are unavailable.

## Findings

| Criterion | Platform evidence | Fresh local result / assessment |
| --- | --- | --- |
| `selection_real_mouse_word_line_range_keyboard` | Drag selected a trailing space, then deletion removed it. Double/triple-click legs passed. | Precisely measured real mouse drag selects only `Checkout requests`; Backspace preserves the following space; Undo restores the line. Platform endpoint correctness cannot be established from its summary. No reproduced app defect. |
| `undo_separate_locations_and_redo_invalidation` | Judge clicked x=1006 outside the editor; LOCATION-TWO was never inserted. | All three full sequentially typed markers, two Undo, two Redo, and redo invalidation pass using visible Find plus keyboard End. Platform sequence was invalid before Undo was tested. |
| `undo_paste_cut_atomic` | Evidence was truncated before transient checkpoints were recorded. | Whole-document equality passes at paste, Undo, Redo, cut, Undo, Redo checkpoints. Local output is compact rather than dumping all 1,226 lines. |
| `find_replace_exact_counts_and_offsets` | Judge script failed before returning cycle/replacement observations. | Existing current-failures diagnostic rerun passes four NEXT clicks returning to line 18, Replace Current, exact 99 Replace All matches, and preserved high-number/tail markers. Exact platform script exception remains unknown. |
| `two_tab_chained_stale_save_conflicts` | Both 409s and data preservation passed, but judge reported only normal Dirty status and no conflict. | Both server-rejected saves show a visible separate `role=alert` message, retain drafts, and preserve exact winning server markers/revisions. Screenshot confirms the alert below the editor. This suggests a missed alert or timing issue, but original trajectory is absent. |

## Fresh local execution

Disposable Docker container using cached `patchpad-preflight-tests:2.0.9`, current
solution/tests mounted read-only, fresh temporary app/database, and current
`app-lifecycle.sh`. Browser: real Chromium via Playwright, 1280x800. This is not
an exact rebuild or validation of the current verifier image/provider setup.
Existing user preview on port 3033 was not touched.

- `current-failures.cjs`: six regression groups completed successfully (dirty
  reload, two Unicode/focus paths, Escape direction, redo invalidation, Find/Replace).
- `reproduce.cjs`: four targeted groups completed successfully: mouse drag,
  three-location Undo/Redo, atomic paste/cut, chained stale-save conflicts.
- `reproduction.json` records the latter results and both exact alert messages.
- `current-failures-2.0.16.json` records the reused diagnostic's fresh results.
- `conflict-visible.png` records the second conflict, with normal Dirty status
  and the separate visible red alert both present.

During diagnostic development, the first mouse coordinate calculation omitted
the text container's 10px left padding and selected one character too few.
Correcting only the diagnostic measurement made the check pass; no app change
was made. The final targeted script explicitly reads back clipboard contents.

## Recommended next changes (not implemented)

Keep requirements, weights and failure thresholds unchanged. Improve judge
execution guidance to measure actual glyph boundaries, verify click hit targets
and focus, and establish each setup precondition before scoring an operation.
Use short boolean/count/hash evidence with immediate transient assertions rather
than returning full documents. On a tool/script exception, recover and rerun the
uncompleted test rather than treating missing observations as proof of app failure.
Inspect all visible error/alert regions after a completed save request; do not
require conflict text to appear in the normal save-status element specifically.

No full current Oracle rerun, complete 35-criterion rerun, fresh static/rubric QC,
exact Docker build, or repeat-platform reliability study was performed here.
These local passes do not change the platform's score and do not guarantee 1.0.
