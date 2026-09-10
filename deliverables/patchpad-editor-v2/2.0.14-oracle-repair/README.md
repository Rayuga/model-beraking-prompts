# PatchPad 2.0.14 - Oracle evidence and targeted UI repair

Upload `patchpad-editor-v2.zip` from this folder for a fresh platform QC and
Oracle run. It contains one `patchpad-editor-v2/` wrapper and the same 30 task
files. Reports, diagnostics, raw runs and historical releases are not included.

SHA-256: `1703dec77e9f275e38664c07a72db54613a7017f65333d35fbb90fbf55ac2570`.

## New exported runs

| Run | Agent | Result | Interpretation |
| --- | --- | --- | --- |
| run-07bf399b / QVt378B | Oracle | reward 0.756; Functional 0.7289; Render/Constraints/Polish 1 | Graded run, 19/27 Functional criteria passed. Eight misses account for 5.625 of 20.75 Functional weight. No reported run exception. |
| run-07bf399b / QN5ko5S | Nop | 0, graded=0, no_op=1 | Expected empty submission; not a model build. |
| run-bfe69a1c / qnt5sss | GPT-5.4-mini | 0, graded=0, no_op=1 | App failed startup before browser grading. Not a measured all-feature failure or an in-range model result. |
| Not found in current PatchPad exports | Gemini | Unavailable | Requested its folder/path; do not substitute the separate GridForge Gemini run. |

All three exported trials share task checksum
`4b5bd3fa138ae8267b3fa555055fbfceb22b82a5e3d38ae3f9924a54721a6e59`.
Every exported Oracle app file matched the initial current 2.0.13 golden.
The 90/10 formula recomputes Oracle's 0.756. See `run-analysis.json`.
Task-checksum and ZIP-checksum formats are distinct; do not equate their hashes.

## Oracle: what actually failed

The export contains criterion reasoning, but not the full browser judge action
trajectory. Therefore a missing observation is not proof of a golden bug, and
a local pass does not prove the judge executed the same actions on the platform.

| Failed Functional criterion | Exported reason | Local evidence/disposition |
| --- | --- | --- |
| unsaved_edit_discard_on_reload | Content discarded and server unchanged, but dirty state not established | Dirty was visible before reload on unchanged 2.0.13. Added live-status semantics; guidance explicitly records it before reload. |
| unicode_grapheme_backspace_delete | Escape did not return focus; required edits not performed | Both Find Enter/Escape and clicked Find Next paths passed locally. Clicked Find Next already focuses the editor; an extra Escape intentionally returns to Find. Preserve the two documented Escape directions; expose current focus and clarify conditional use. |
| unicode_grapheme_navigation_selection | Copied an old e+accent selection instead of the full new sample | Fresh query/selection, clipboard completion and both focus paths passed on 2.0.13. No grapheme algorithm change is justified by this export. |
| selection_real_mouse_word_line_range_keyboard | Coordinate-measurement error left double/triple-click evidence missing | Existing exact real-mouse local tests pass. Guidance permits correcting a read-only measurement before the gesture, not repairing a failed gesture/result. |
| undo_separate_locations_and_redo_invalidation | Earlier edits/Undo/Redo exact; Redo remained enabled and final behavior unestablished | Confirmed misleading enabled control with an empty redo stack. Existing implementation already prevented resurrection. Fixed button availability and independently tested shortcut/content invariants. |
| undo_paste_cut_atomic | Immediate cut checkpoint still showed PASTE-B | Full exact cut/Undo/Redo passes with established selection and awaited clipboard/document completion. No proof from this limited export of a new text-model defect; asynchronous/focus risk remains. |
| find_replace_exact_counts_and_offsets | NEXT navigation worked; Replace Current did not yield FOLLOWUP, Replace All yielded 0 | Unchanged golden passes exact field readback, replacement at line 18 and all 99 replacements. No implementation replacement bug reproduced. |
| multi_caret_backspace_delete_sibling | Carets were at line starts for the Backspace leg, causing joins | Existing end/start multi-caret tests pass. Guidance calls for glyph-boundary measurement and visible caret-position checks before the one deletion; does not allow fixing a wrong gesture afterward. |

The unchanged 2.0.13 reference completed the full local regression successfully
before edits. That baseline is retained in `baseline-2.0.13/` and
`regression-1.log`, including `redoDisabledAfterNewEdit: false` while discarded
text still could not be resurrected. These findings do NOT justify claiming
all eight were code bugs or that eight source fixes were needed.

## GPT startup diagnosis

Its unchanged db.js hardcodes the private interpreter
`/root/.local/share/uv/python/cpython-3.12.14-linux-x86_64-gnu/bin/python3.12`.
The clean unprivileged verifier environment supplies neither its optional
PYTHON/PYTHON_BIN override nor access to that root-owned agent installation.
The local reproduction exits 1 with `spawnSync ... EACCES`, before the server
listens. The platform stdout independently reports readiness failure.

This is an artifact portability/dependency failure, not evidence that networking
was disabled. Both configured task networks are public. Increasing readiness
time cannot keep a process alive after that fatal startup exception. We did
not repair the model artifact, grant root access, weaken the runner, or count
the no-op as a valid model-breaking score. See `gpt-startup.json`; reproduction
used a disposable, offline, read-only-root container and an unmodified copy
of the exported artifact.

## Source changes and preserved QC repairs

- Golden Undo/Redo controls are now disabled when their stacks are empty.
  Disabled buttons have visible styling. Text-model/undo semantics are unchanged.
- Save/dirty state is exposed as a polite live status. A visible focus hint
  distinguishes editing, Find and replacement-field focus without changing
  selection, keyboard semantics or the required custom surface.
- Functional prompt adds observation guidance for transient dirty state,
  conditional Escape, glyph-based coordinate setup and actual Redo effects.
  No assertion is removed and no unobserved result is awarded credit.
- Release markers change consistently to 2.0.14.

All 35 criterion definitions, types, weights and IDs remain identical. The
90% Functional / 10% Polish formula, custom-surface hard gate, server-backing
prerequisites, simple Render/Constraints criteria, startup/readiness, manifest
contract, single lifecycle helper, restarts, seed/server code, dependencies,
all eight brief files, public/public networking, separate verifier and judge
settings remain unchanged. Judge: Codex, `openai/gpt-5.6-luna`, high effort,
temperature 0. There is no provider-key setup in test.sh.

`package-audit.json` records 139 local preservation/structural assertions,
including unchanged criteria and prior prompt retention, no credential literals,
exact inventory, LF/UTF-8, archive CRC and source/member byte equality.

## Validation scope and limits

The final rerun, `regression-3.log`, completed with exit 0; all suites listed
below passed. `current-failures-2.0.14.json` records six new passed diagnostic
groups and `redoDisabledAfterNewEdit: true`. Baseline 2.0.13 recorded false.

The fresh-source regression uses `patchpad-preflight-tests:2.0.9` as the local
tool image, with the current task mounted and a clean app/database per suite.
It is NOT a successful exact 2.0.14 Docker build. Both fresh builds were attempted
and failed because the configured proxy hostname could not resolve while
fetching Debian/browser dependencies. No host proxy settings were changed.

Unpaid suites cover server/client/shell syntax, no-op handling, manifest parser,
baseline editor checks, eight earlier Oracle failure paths, browser variants,
fourteen broader editing/persistence/API cases, two restart replacements,
destructive-reseed and missing-route negative controls, runner aggregation,
the three later Oracle repairs, four brief-alignment cases, the custom-surface
fixtures and 30 reward cases plus 16 invalid-score rejections. New diagnostics
cover both Unicode Find routes, dirty-before-reload, focus toggle direction,
Redo invalidation and exact 99-match replacement.

The additional local regression had two negative/no-op probes that blindly
clicked Undo/Redo even with empty stacks. A task-specific copy now asserts
those controls are disabled and still tests keyboard no-op/content invariants.
Historical test files are unchanged. `regression-2.log` is an intentionally
stopped intermediate run; use the final completed rerun result, not that log.

No paid Oracle/model, official static/rubric QC, or full Codex browser-judge
regrade was launched. The user's previous rubric pass is historical evidence
for 2.0.13, not a new 2.0.14 pass. Local script success is not Oracle 1.0.
Remaining risks: browser-judge focus/coordinate/clipboard execution, subjective
Polish grading, fresh image builds/bootstrap, and unavailable Gemini evidence.
Run fresh platform QC/Oracle on this exact ZIP before claiming the score is 1.
