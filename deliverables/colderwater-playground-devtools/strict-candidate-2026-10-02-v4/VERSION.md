# Colderwater strict candidate v4, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `68cf2fbee486310529dfc0f8807784058f064a6af3bda5ab664c2adb56a35e0a`
- Files: 43, single root `colderwater-playground-devtools/`
- Source: commit 8e957425 on branch `task/colderwater-editor-strict`; every file is byte-identical to `projects/colderwater-playground-devtools`.
- Frozen QC input: `6f9c2cc5e7bc3b3b8f5b2adeccbfa83fff17cf4d61860c39a9ff441f7f80ee44` (`qc/runs/coldwater-strict-2026-10-02-r10`)
- Criteria: 1 render gate, 2 constraints gates, 42 Functional, 6 Polish, 3 Visual.

Changes from v1 (portal run 1: Oracle 0.9833, Luna 0, nop 0):
- The render gate only checks that the workspace loads and the editor takes typing; the typed-program Run check is the Functional criterion `cw_basic_run_output`.
- Run is no longer charged again inside the long-line, narrow-width and feedback criteria.
- The golden's layout was polished to recover the Visual point the Oracle lost.

Status: test candidate, not cleared by a formal round. The scripted golden passes all 51 gate, Functional and Polish checks on these bytes. v2 and v3 are superseded by this archive.
