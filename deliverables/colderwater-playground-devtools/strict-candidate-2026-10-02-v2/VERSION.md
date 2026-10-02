# Colderwater strict candidate v2, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `dea75ba4ee830e393abb59bd0cc4a6e0fe483044899e5c480e1827c68948c3a4`
- Files: 43, single root `colderwater-playground-devtools/`
- Source: commit 6c270bf0 on branch `task/colderwater-editor-strict`; every file is byte-identical to `projects/colderwater-playground-devtools`.
- Frozen QC input: `51c18fbc529317d8c982159ca918c1e31d8dd94c59e641c1b0fb89a2b3841c11` (`qc/runs/coldwater-strict-2026-10-02-r8`)
- Criteria: 1 render gate, 2 constraints gates, 42 Functional, 6 Polish, 3 Visual.

Change from v1 (`strict-candidate-2026-10-02`, uploaded for portal run 1): the render gate only checks that the workspace loads and the editor takes typing; the typed-program Run check moved into Functional as `cw_basic_run_output`.

Status: test candidate, not cleared. The scripted golden passes all 51 gate, Functional and Polish checks on these bytes. The Oracle result of portal run 1 had not been seen when this was built.
