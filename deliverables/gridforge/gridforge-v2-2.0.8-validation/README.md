# GridForge 2.0.8 Upload Handoff

Upload `gridforge-spreadsheet-v2.zip`. It contains one
`gridforge-spreadsheet-v2/` wrapper and 32 task files. Its contents match the
current source hashes in `qc-preflight.json`.

SHA-256:
`6b5249f0875fdc5f14ee0f1e2212eba8fc170c2bf0dee7320406afaa55fa1b74`

Both agent and verifier networking are **public**. The verifier remains
separate from the agent environment. The brief allows dependency installation
during development while retaining the custom-grid requirements and locally
served runtime resources. Historical reports and archives were not overwritten.

## Evidence

- Both current Docker images built successfully.
- 34/34 local structural checks passed.
- Actual RewardKit discovery found 44 criteria: 2 Render, 2 Constraints,
  36 Functional and 4 Polish.
- Empty-submission testing returned reward 0.0.
- All 24 local browser regression groups passed with no fatal browser errors.
- Coverage includes real restart persistence, previous Oracle failures,
  reference-picking and caret/operator interactions, range gestures, function
  recalculation, error recovery, fill, concurrent drafts and conflicts,
  three-view presence cleanup, and 27 rejected save/session/identity probes.
- The ZIP has no credentials, databases, dependencies, caches or authoring reports.

The local tests initially exposed two test synchronization problems: reading
cell coordinates during a redraw and asserting presence selections before the
allowed five-second update window. The local checks now wait for these states
without repeating user actions. These were validation-script fixes; task source,
golden behavior, criteria and weights were not changed during this preparation.

## Platform Run Still Required

No paid Oracle or model run was started, as requested. These local tests are
not an exhaustive 44-criterion judge run, a fresh 53-check platform QC result,
or a guarantee of Oracle 1.0. The older Oracle score of 0.8973 applies to its
older artifact only. Run the platform QC and Oracle on this exact ZIP next.

`local-validation.json` contains measured regression results;
`structural-checks.json` contains packaging checks and source hashes;
`qc-preflight.json` summarizes the release evidence and limitations.

Repackage after any task source edit. To regenerate the archive without touching
PatchPad or historical reports, use the shared packaging helper's `--task
gridforge-spreadsheet-v2 --output-dir deliverables/gridforge/gridforge-v2-2.0.8-validation`
options, then run `finalize-release.py` after the local suite succeeds.
