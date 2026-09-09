# PatchPad 2.0.7 — Oracle and Haiku investigation

## What the supplied runs actually show

| Run | Agent | Result | Interpretation |
| --- | --- | --- | --- |
| run-6e931938 / KBkofJR | Oracle, golden 2.0.6 | 0.8482; Functional 0.747, other dimensions 1.0; 28/35 criteria pass | A completed browser grade, not a timeout or readiness failure. |
| run-6e931938 / nSHDDH2 | No-op | 0 | Expected control. |
| run-32a383d4 / ZCnGYjw | Claude Haiku 4.5 | 0; graded=0, no_op=1 | Rejected by the manifest preflight before any browser criteria were evaluated. |

The Oracle's exported golden JS/HTML/server files exactly match the current
2.0.6 implementation after line-ending normalization. `readiness.log` confirms
the browser entry was ready. The full judge browser action trajectory was not
exported; reward-details contain short verdicts, not enough to reconstruct every
key, focus transition, clipboard operation or mouse gesture.

The Haiku manifest has a `SQLite Database Path` heading and a fenced database
path, but no `SQLite path: /app/...` line. The brief explicitly requires that
line and the preserved parser checks it. This is a real submission-contract
miss, not a provider/key/network error. No feature failure breakdown exists:
none of the 35 browser checks ran. The manifest rule was not weakened and the
captured model artifact was not repaired or relabelled as a graded browser run.

## Seven Oracle failures and dispositions

| Criterion | Exported observation | Investigation and change |
| --- | --- | --- |
| edit_save_reload_and_fresh_client | BASIC-SAVE-CHECK saved twice | One-insertion/one-save local checks pass. No duplicate insertion is reproduced. Guidance now separates setup from observation and forbids repeating insertion in the fresh client. |
| unicode_grapheme_backspace_delete | Emoji Undo failed; decomposed deletion left Ae | Exact clipboard/Find/editor-focus/one-command regression passes. Focus or input sequencing is a hypothesis, not a proven cause. Each Find transition now explicitly returns to editor focus before deletion/Undo. |
| unicode_grapheme_navigation_selection | Exact selections not established | Exact A, emoji and decomposed-accent clipboard checks pass. Guidance explicitly verifies editor focus and awaits each fresh clipboard result. |
| selection_real_mouse_word_line_range_keyboard | Drag removed the whole line | Exact double-click, triple-click and separate two-word drag regression passes. Guidance distinguishes separate gestures and fresh coordinates; it still fails a correctly executed gesture producing the wrong selection. |
| selection_autoscroll_exact_offscreen_range | Required real-mouse selection not completed | Held-button real autoscroll and 50 shifted Down presses pass. Guidance explicitly keeps the mouse down during scrolling and waits for the target before releasing. |
| clipboard_external_multiline_internal_exact | Ctrl+A copy remained 15 characters | Full-document copy passes locally. A stale clipboard result or wrong focus is possible but unproven. Guidance explicitly copies after Ctrl+A and awaits the new whole-document clipboard value. |
| find_replace_exact_counts_and_offsets | ALPHA-00 replaced with wrong value | Both replacement phases pass locally. The previous text only implied updating the second replacement field; it now explicitly switches FOLLOWUP to INCIDENT-MARKER-00 and reads back both fields before the one Replace All. |

No golden implementation defect was reproduced. Therefore no speculative
editor-code fix was made. The changes address test execution clarity and
observability; they do not prove all historical failures were judge errors.
Original descriptions are preserved verbatim with appended execution guidance.
An unexecuted or unestablished check still receives no credit.

## Preservation and validation

- Release 2.0.7 retains exact name `patchpad-editor-v2`, public/public networking,
  separate verifier, pinned Codex/luna/high setup and the same timeouts.
- Exactly 35 criteria remain: 2 Render, 2 Constraints, 27 Functional, 4 Polish.
  All criterion ids, types, weights and original assertions are preserved.
- Only seven Functional descriptions and the Functional prompt gain execution
  guidance; other source differences from 2.0.6 are version markers only.
- Golden logic, instruction files, seed data, reward formula, manifest parser,
  explicit readiness check and the single restart helper are byte-identical.
  Earlier focus, Unicode, clipboard, restore/Undo and API-rejection repairs remain.
- Both final Docker images built successfully using cached dependencies.
- Fresh local reproduction of the unchanged golden passed 8 historical failure
  regressions and 14 additional groups, including exact save, mouse selection,
  offscreen selection, whole-document clipboard, full revision preview/restore,
  undo-to-saved status, save-in-flight editing and direct server rejection checks.
- Final 2.0.7 Docker validation passed syntax, RewardKit discovery, empty-submission
  zero, 5 accepted / 6 rejected manifest cases, and 22 browser groups: 6 QC/focus,
  6 smoke, 2 restart/documentation and 8 historical failure paths. These overlap
  the targeted regressions and are not a fresh 35/35 Oracle score.
- The real runner with a trusted local score stub passed two restarts, cleanup
  and unchanged score aggregation. Stub scores are not Oracle results.
- Two disposable negative controls were correctly rejected: destructive startup
  reseeding and missing manifest API documentation. No task tests were weakened.
- ZIP audit verifies all 30 expected files, one wrapper, UTF-8/LF, no secret
  literals/generated files, original assertions, unchanged weights, preserved
  2.0.6 archive hash and exact archive-to-source hashes.

## Remaining risks and next step

No paid Oracle/model, actual platform static checker or fresh platform rubric
review was run. The 2.0.6 scores are historical and must not be reported as
validation of 2.0.7. An LLM judge may still omit actions or vary its assessment.
The full action trace would be needed to prove the unexplained historical
failures. Public-network policy and previously documented qualitative/bundling
risks remain unchanged. A fresh platform QC and Oracle run is required; neither
QC success nor Oracle 1.0 can be guaranteed from local tests.

ZIP: `patchpad-editor-v2.zip`

SHA-256: `519499a273db36a057184b630f7dc89a6f4800fa8583113f92fd39517ec5cae8`

Evidence and scripts in this directory are outside the ZIP. Existing delivery
folders, run artifacts, Brickfall and GridForge were not modified by this work.
