# Colderwater hardening — working evidence record

This is a work-in-progress record, not upload clearance. The independent R1 audit must finish before its findings are reconciled and a corrected candidate is frozen.

## Measured baseline

The downloaded original candidate scored Oracle **1.0**, Luna **0.8564**, and nop **0**. Luna's functional score was **0.7884**, polish **1.0**, and visual **0.9167**. See `historical-run-timing.json` for the hashed result files. These grades apply only to that original candidate.

## Changes in the current candidate

- Removed required theme switching, separate CSS-file execution, starter/example catalogue, and title uniqueness/normalisation rules together with their dedicated criteria.
- Added durable immutable revision history, read-only inspection without draft loss or execution, restore-as-new-revision, stale restore handling, exact-attempt retry after lost replies, and competing Save/restore operations.
- Tightened existing probes for real user-edited preview state, valid JavaScript containing script-looking text, stopped handlers changing the DOM, and queued Auto-run work after manual Run or document changes.
- Updated the golden server, editor and runtime to implement the revised product. Shared harness, reward policy, model wiring and timeout budgets remain unchanged.
- There are currently 80 functional criteria across 22 shared protocols, 6 polish criteria, 6 visual criteria, and 2 gates. Criterion count alone does not establish difficulty or workload.

## Local product observations

`functional-coverage.json` maps all 80 current functional rows to passing scripted observations. `surface-results.json` records the two gates and six polish checks. History retry was exercised after a real Docker process restart. These are scripted product observations, not a fresh configured Oracle grade or a complete proof of the public contract.

The first independent review found an additional golden counterexample outside those original probes: button-drawn canvas pixels disappear on rollback. The public promise to retain the successful picture requires a correction and a regression test. The row 17 report and its raw proof are preserved under the R1 run directory.

The full frozen installation also failed: local Windows build dependencies were accidentally included in the task snapshot and shadow the image's Linux SQLite dependency. See `install-r1-observation.md`. The earlier browser target contained only the server and built assets, so it did not exercise this packaging defect. The corrected package must pass the actual `solve.sh` installation path.

## Difficulty evidence and limits

The downloaded Luna app fails four focused browser probes: script-looking text in a JavaScript string, restoring an actual user-edited input, suppressing a stopped handler's DOM changes, and consuming a pending Auto-run on manual Run. The revised golden passes those probes. See `luna-witness.json`.

This does **not** establish a fresh Luna score near 0.5. An illustrative calculation using old grades for untested retained rows and assuming the absent history feature fails gives approximately **0.671**, and even includes an unmeasured pessimistic assumption. It is not a grade or forecast. A newly built Luna app can implement the new instructions. Do not claim that the target score has been achieved or that history alone will achieve it.

## Audit process

R1: `qc/runs/coldwater-2026-10-01-history-hardening-r1`.

Use one fresh reviewer context per workbook quality row, plus one complete independent 48-row deterministic review, with the frozen workbook and Harbor skill. Finish all rows, reconcile the union, correct confirmed task-specific defects, then perform another complete round on the new bytes. Keep shared-template/restart concerns and unavailable configured-judge measurements visible as the user's accepted limitations; do not turn them into invented Pass verdicts.

## Pending fixes collected during R1

These are queued for reconciliation; no reviewed source has changed during the round.

1. Move `solution/app/node_modules` out of the task into the ignored build cache. Verify both absolute paths before moving. Keep built public assets and use the cached Vite CLI for later builds. Re-run the full `solve.sh` installation from a different working directory.
2. Remove the unnecessary mandatory sentence about starting with an empty library from integration instructions. Keep the truthful description that the supplied seed has no saved records.
3. Let the controlled lost-response probe accept automatic same-attempt recovery as well as a manual retry. Keep the original-result, no-extra-revision and no-overwrite observations.
4. Preserve canvas pixels in the static successful-preview snapshot. `drivers/canvas_regression.cjs` now reproduces lost pixels on error, completed Stop and timeout; form values survive in all three. The first diagnostic driver attempt used overly narrow status labels and is retained separately as a driver error, not a product finding.
5. Commit the corrected task source and compiled assets before the next freeze, so the exact reference is recoverable from Git. Only stage the task and our own authoring changes, not concurrent HireOps work.
6. Align the visual colour anchor with the prompt's single reviewed appearance; remove the leftover obligation to inspect every offered theme. Also remove the obsolete mention of title validation from the constraints gate's list of scored behaviours.
7. Strengthen the basic Render prerequisite with a fresh computed JavaScript result displayed and logged by the app. The row 39 isolated literal-string mock passes existing gate observations and 2.4/45.25 cheap functional weight without executing JavaScript. Preserve the shared floor and formula; do not move difficult history or timeout behaviour into the gate. Validate the corrected prerequisite against the real golden, downloaded Luna app, and the retained mock.

The exact frozen agent environment was built as `qc-coldwater-row16:history-hardening-r1` (image `sha256:d6bd1b069a0cf51e6ae1d5ba95b3cdc98367bf5692d45f1bb26288e30203a082`). Independent probes verified preinstalled dependencies and hashes of all seven staged input files. This does not rescue the separately defective solution dependency bundle.

## New shared-template issue requiring an upstream decision

Row 46 reproduced a separate inherited isolation flaw, beyond the previously accepted restart concern. RewardKit 0.1.7 passes the complete private prompt as `claude -p <prompt>` arguments. The unprivileged app shares the judge's PID namespace and can read those arguments through `/proc/<pid>/cmdline`. A disposable network-disabled probe used the real installed RewardKit command builder and an inert CLI stand-in; it recovered the sentinel prompt as UID 65534. Direct reads of protected tests and writes to rewards remained denied. No provider call, credential exposure or successful reward exploit is claimed.

Evidence: R1 `per-row-review/evidence/46/metadata.json`, installed source, `rows/46-isolation-probe.py`, and `rows/46-isolation-probe-result.json`. All relevant shared task files match the mandated template byte-for-byte. Fix direction: pass private prompt content without public process arguments, or isolate the app's process namespace/proc view. This requires a shared runner/library change; the task-specific authoring pass must not silently alter the template or treat this newly found issue as covered by the old restart exception.
