# Colderwater strict candidate v9, 2 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `f021d71e8b0e77b6229fc76335df638f34cbe569afe9ba5bcc986b75d1220d91`
- Files: 43, single root `colderwater-playground-devtools/`, LF line endings
- Source: task bytes of commit 8fa281de on branch `task/colderwater-editor-strict` (archive built at ceeb95f7, which adds only QC records); every file is byte-identical to the committed `projects/colderwater-playground-devtools`.
- Frozen QC input: `5c36bbfa4c7ec159eddd5e15f96ee996c3d83606f97dabd754c167f8a08a6d75` (`qc/runs/coldwater-strict-2026-10-02-r16`)
- Criteria: 1 render gate, 2 constraints gates, 43 Functional (weight 59.0), 6 Polish, 3 Visual.

Review of these exact bytes (round r16, 53 row reviewers and one deterministic reviewer, all valid):
- Quality rows: 49 Pass, 0 Fail, 3 Note (rows 6, 32, 42), 1 Not exercised (row 40).
- Deterministic rows: 37 Pass, 0 Fail, 6 Note, 5 N-A.
- Pipeline status is BLOCKED, not cleared: 4 evidence gaps and 15 rows flagged as risk, all for the same reason. No configured judge run exists for these bytes, and rows 40 and 42 need a graded partial-quality app. Only a portal run can supply that.
- Row 18 drove this golden with the judge's own browser tool (playwright-mcp 0.0.79): both gates held, a reload with unsaved text returned in under 200 ms with no dialog, and every Functional sample tried behaved as its criterion requires.

Changes from v8:
- All five judge prompts carry the check-only rule: the judge checks the named feature as delivered, never repairs or works around it, and a feature that does not work scores 0.
- From round r15 (47 Pass, 3 Fail): the golden no longer asks to leave the page on reload, and the judge notes say a leave-page dialog is to be accepted; line 1, column 1 at the document start is graded; the Run after a time limit has one owner.
- Small notes taken: the Run feedback check uses a draft that logs nothing; the visual judge resizes to 1440 by 900 first; `cw_history_restore_retry` is renamed `cw_history_restore_adds_revision`.

Golden verification after the round, on the same bytes: scripted golden 52 of 52 gate, Functional and Polish checks, with a real restart; the three public-text hygiene checks pass.

Known notes left unchanged so the reviewed bytes stay the shipped bytes:
- `cw_html_preview` relies on inline handler attributes working, which the notes imply but do not name.
- The Stop step inside `cw_last_good_recovery` does not name a pending-timer draft; the WebAssembly refusal check does not name a valid module.
- Deterministic notes: `XXX` substrings inside a vendored bundle and a lockfile hash; `/app/server.js` is named in the integration note, not in `instruction.md`.

Not measured: Oracle and Luna scores for this version. v4 to v8 are superseded.
