# Colderwater strict candidate v3, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `7bcc170b9dd5cfb1fc1ee93f0044159a04a5dfa5efbd986137b3c88edbf04068`
- Files: 43, single root `colderwater-playground-devtools/`
- Source: commit 56accd78 on branch `task/colderwater-editor-strict`; every file is byte-identical to `projects/colderwater-playground-devtools`.
- Frozen QC input: `4379c96f70811fa36fc3fb4b06754661b7a7501dd85dcfd2db21a94f379cacdf` (`qc/runs/coldwater-strict-2026-10-02-r9`)
- Criteria: 1 render gate, 2 constraints gates, 42 Functional, 6 Polish, 3 Visual.

Changes from v1 (uploaded for portal run 1, Oracle 0.9833, Luna 0):
- The render gate only checks that the workspace loads and the editor takes typing; the typed-program Run check is the Functional criterion `cw_basic_run_output`.
- The golden's editor toolbar and saved-snippet list were tidied to recover the Visual point the Oracle lost.

Status: test candidate, not cleared. The scripted golden passes all 51 gate, Functional and Polish checks on these bytes. v2 is superseded by this archive.
