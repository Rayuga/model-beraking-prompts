# HireOps candidate: individual mode with the round-6 fixes (8 October 2026)

This folder holds `hireops-recruiting-operations.zip` (sha256 `c217d423…a56a9a`, 35 files). It packages the task after the round-6 QC fixes and replaces `2026-10-08-individual-mode-precheck`.

## QC status

The task is not QC-cleared:

- Round 6 was blocked. Its fixes are in this package, and the round-6 bytes have not been re-reviewed.
- One structural issue is still open: binary bundles in individual mode can invert the ranking of apps (row 42). It needs the owner's decision. The details are in `qc/runs/hireops-lessons-2026-10-08-r6/RECONCILIATION.md`.

## Checked

- The golden was installed with `solve.sh` into an empty `/app`. It was launched as uid 65534 from another working directory and restarted for real. It passes all 26 scripted groups.
- The public grader-term, criterion-id and network-policy checks pass, and so do the packaging checks.

## Not measured

- No configured judge run.
- No Oracle score.
- No Luna score.
- No judge durations.

## Deviation from the template

The functional judge uses `mode = "individual"` with `timeout = 600`, at the lead's instruction. Because of this, the local preflight's `judge header:functional` check reports false.

With 15 functional criteria at 600 s each, plus 900 s for polish and 900 s for visual, the worst case is 10800 s. That fits the 11100 s scored budget in `tests/test.sh`, but the timing has not been measured.

Nothing has been uploaded.
