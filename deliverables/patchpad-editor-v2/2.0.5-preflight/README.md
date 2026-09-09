# PatchPad 2.0.5 — fresh platform preflight

Prepared 2026-09-09 from merged source 2.0.4. Historical reports and ZIPs were
left unchanged. Only projects/patchpad-editor-v2 and this PatchPad-only delivery
folder were changed; no shared packaging/context edits, branch changes or commits.

## Upload artifact

- File: `patchpad-editor-v2.zip`
- Task name: `turing/patchpad-editor-v2`
- Version: `2.0.5`
- SHA-256: `5d551d9f2b11a45e27045298f8a90fb4a63a978bcf6596df6813feb19229dcee`
- Exactly 30 files beneath one `patchpad-editor-v2/` wrapper.
- Both network modes are public, with a separate verifier.
- 35 criteria retained: 2 Render, 2 Constraints, 27 Functional, 4 Polish.
- Functional criterion mass remains 20.75. All individual criteria, weights,
  instructions, reward logic and judge prompt bodies are unchanged.
- Codex / openai/gpt-5.6-luna / high reasoning / temperature zero retained.
- `package-audit.json` includes every source SHA-256, exact ZIP/source comparison,
  CRC validation, parsed criteria comparison against the merged baseline, and
  final Docker image IDs. No dependencies, DBs, credentials, caches or reports
  are in the task ZIP.

## Golden repairs

1. Mouse focus uses preventScroll so the first click does not shift the target
   under a real double/triple click. The earlier failure selected text on the
   next line instead of Timeline.
2. Preview shows the full revision instead of truncating at 1,200 characters.
3. Restore adds a normal undo checkpoint without destroying older undo history.
4. Dirty state compares with saved content, so Undo back to the saved document
   reports Saved. Loading a document clears obsolete local Undo/Redo history.
5. A save tracks its submitted content and pending status. Edits typed while
   its response is pending remain dirty and can be saved next; duplicate pending
   save commands are suppressed.
6. Explicit empty/null/false/zero documentId values are rejected instead of
   bypassing the URL/body identity check.

Changed application files: solution/app/public/js/app.js and
solution/app/src/index.js. Release markers changed in task/package metadata,
both Docker labels, and all judge/prompt comments. No new lifecycle helper or
restart criterion was introduced.

## Fresh unpaid validation

All results below were obtained against the repaired source/final 2.0.5 images,
not inferred from historical reports:

- Both canonical Docker images built successfully (cached layers reused).
- Golden solve.sh installed and seeded successfully inside the actual agent
  image with networking disabled for the diagnostic container.
- Actual RewardKit discovery: 2/2/27/4; shell syntax for installer/runner/lifecycle,
  JavaScript syntax, and TOML/JSON parsing passed.
- Empty submitted app: actual test.sh wrote zero reward without invoking a judge.
- Manifest parser: 5 valid declarations accepted, 6 invalid declarations rejected;
  unrelated backup retained. Covers arbitrary extensions, no extension and spaces.
- 36 browser regression groups: 6 focus/conflict groups, 6 baseline smoke groups,
  8 previous Oracle failure paths, 2 restart/documentation groups and 14 additional
  groups. These overlap in coverage and are not 36 independent scored criteria.
- Restart check replaced the managed process group twice and preserved exact
  current document, metadata, complete history and historical contents.
- Both Alt and Control three-caret paths, Unicode, exact clipboard timing,
  Find/Escape/click focus, whole typing groups, selection replacements, real mouse
  word/line/range selection, offscreen drag, long-document integrity, saved-state,
  in-flight saves, restore/Undo, and all current server rejection probes passed.
- Two disposable broken variants were correctly rejected: startup reseeding
  and absent manifest route documentation. Canonical source was never mutated
  to run these negative controls.
- Trusted local stub: two restart calls, final cleanup, and score aggregation
  passed. Nine more runner cases passed: valid scores, Render zero, Constraints
  zero, missing dimension, invalid JSON, boolean score, NaN, out-of-range value
  and stub crash. These injected numbers are not Oracle scores.
- 82/82 local structural/package assertions passed, including source hashes,
  ZIP CRC, single-wrapper inventory, unchanged scoring and public/public settings.
- The fresh 1280x800 screenshot was inspected: editor, toolbar and history are
  readable and separated; long lines use horizontal editor scrolling. This is
  not a numerical Polish judge result.

Evidence: local-validation.json, additional-regression.json,
oracle-failures-regression.json, restart-regression.json, qc-regression.json,
patchpad-smoke.json, coverage-negative-controls.json, harness-integration.json,
harness-matrix.json, package-audit.json and patchpad-golden.png.
local-validation-2.0.4.json and additional-before-repairs.json are explicitly
pre-repair diagnostic evidence, not final validation.

## Boundaries and remaining risks

No paid Oracle/model was run. The old 0.8143 Oracle predates these repairs and
does not establish a result for this package. Fresh platform QC and Oracle are
still required; neither Oracle 1.0 nor a 53/53 platform score is guaranteed.

The supplied workbook's no-network-agent / allowlisted-verifier descriptions
conflict with the current explicit public/public request. Public/public is
preserved; platform interpretation needs confirmation. The workbook contains
53 quality rows and 58 listed deterministic checks, not their executable code.

VERIFIER-REVIEW.md maps every current criterion to instructions, golden code and
fresh local evidence, and records residual fairness/interpretation risks rather
than hiding them. We did not run actual model bootstrap, macOS Meta-key paths,
paid judge discovery/timing, repeated scoring variance or adversarial reward
distributions. Browser regressions use Linux Chromium and golden-specific
selectors; they cannot prove the judge will execute every interaction correctly.

## Reproduce without paid calls

From the repository root, build the two images with tags
patchpad-preflight-env:2.0.5 and patchpad-preflight-tests:2.0.5 from the task's
environment/ and tests/ respectively. Use a disposable container with --network
none, tmpfs /app and /logs/verifier, and these mounts:

- projects/patchpad-editor-v2/solution -> /solution (read-only)
- deliverables/patchpad-incident-editor-validation -> /validation (read-only)
- deliverables/editor-v2-validation -> /baseline (read-only)
- this delivery directory -> /results

Run python3 /validation/validate-local.py, /results/run-additional.py,
/validation/validate-coverage-mutants.py, /validation/validate-harness.py and
/results/harness-matrix.py in separate disposable containers. The /baseline
script is invoked only with the patchpad argument; no GridForge task is run.
On the host, audit-and-package.py recreates only this PatchPad ZIP and evidence.
The offline diagnostic flag is not a change to the task's public network modes.
