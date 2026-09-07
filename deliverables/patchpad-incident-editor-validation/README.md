# PatchPad QC repair, 2026-09-07

Active task: `projects/patchpad-editor-v2`, version `2.0.3`, as explicitly
requested by the user. Use `patchpad-editor-v2-2.0.3-task.zip` for upload.
Earlier archives are superseded. The last platform screenshot reported 52/53
passed, with only restart/manifest coverage failing; this version repairs it.

Subsequent Oracle run-74864554 on 2.0.2 scored 0.8143 (25/33 passed). Version
2.0.3 fixes the observed command-focus defects and verifier sequencing issues.
All eight previously failed paths are covered in oracle-failures-regression.cjs.
Its JSON records local results; no new full Oracle score is claimed.

`patchpad_qc_rework.json` explains the nine reported findings and records the
53-row workbook inventory. Unreviewed rows are not automatically marked passed.
The workbook's 58 deterministic-check descriptions are not executable checkers.

## Evidence

- Both agent and verifier Docker images built successfully.
- The golden installer completed offline in the actual agent image.
- `local-validation.json`: actual parser tests (five accepted declarations and
  six rejected ones), shell/JavaScript syntax, RewardKit discovery, empty-app
  zero scoring, six targeted browser groups and six baseline browser groups.
- `qc-regression.json`: Tab/Escape, word boundaries, match counts and two-tab
  stale-save behavior exercised through real browser input.
- `patchpad-smoke.json` and `patchpad-golden.png`: baseline regression evidence.
- `restart-regression.json`: two real process restarts preserve exact saved
  content and revision history; documented routes match live API requests.
- `oracle-failures-regression.json`: eight exact browser groups covering Unicode,
  paste/cut, Find, both modifier-click paths, and revision restore Undo.
- `coverage-negative-controls.json`: disposable startup-reseed and missing-route
  variants are both rejected by the targeted checks.
- `harness-integration.json`: a trusted stub exercises lifecycle cleanup and
  aggregation without calling a judge; the injected score is not an Oracle result.
- `check-and-package.py`: local structural assertions, source hashes, ZIP
  CRC and byte-for-byte source comparison. This is not the platform checker.

No provider credentials or paid model calls were used. Local checks do not
establish a 53/53 platform verdict or a complete 33-criterion Oracle result.
Next: upload the corrected archive, inspect platform QC, then run the full
Oracle before treating the task as delivery-ready.

## Reproduce

From the repository root, build:

```powershell
docker build -t patchpad-editor-v2-env:2.0.3 projects/patchpad-editor-v2/environment
docker build -t patchpad-editor-v2-tests:2.0.3 projects/patchpad-editor-v2/tests
```

Run the local suite in an isolated, offline disposable container:

```powershell
$root = (Get-Location).Path
docker run --rm --network none --tmpfs /app --tmpfs /logs/verifier --mount "type=bind,source=$root\projects\patchpad-editor-v2\solution,target=/solution,readonly" --mount "type=bind,source=$root\deliverables\patchpad-incident-editor-validation,target=/validation,readonly" --mount "type=bind,source=$root\deliverables\patchpad-incident-editor-validation,target=/results" --mount "type=bind,source=$root\deliverables\editor-v2-validation,target=/baseline,readonly" patchpad-editor-v2-tests:2.0.3 python3 /validation/validate-local.py
python deliverables/patchpad-incident-editor-validation/check-and-package.py
```

The host packaging helper needs Python 3.11+ and openpyxl, plus the supplied
root `WebDev Rubrics QC.xlsx`. These are authoring tools, not task dependencies.
