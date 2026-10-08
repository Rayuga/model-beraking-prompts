# HireOps candidate: individual-mode precheck (8 October 2026)

`hireops-recruiting-operations.zip` (sha256 `5b9d6b50…c228e0`, 35 files) packages the task bytes after the round-5 fixes. This is the same input as QC round 6.

**Not QC-cleared.** Round 5 was BLOCKED, and the round-5 fixes are in this package. Round 6 runs against the same bytes; see `qc/runs/hireops-lessons-2026-10-08-r6/` when it finishes.

What has been checked:
- The golden was installed with `solve.sh` into an empty `/app`, launched as uid 65534 from another working directory, and restarted for real. It passes all 26 scripted driver groups.
- The public grader-term, criterion-id and network-policy checks pass, and the packaging checks pass.

What has not been measured:
- No configured judge run.
- No Oracle score.
- No target-model (Luna) score.
- No measured judge durations.

Known deviation from the template:
- The functional `judge.toml` uses `mode = "individual"` with `timeout = 600`, at the lead's instruction.
- The local QC preflight therefore reports `judge header:functional` as false.
- 15 × 600 s plus 900 s for polish and 900 s for visual comes to 10800 s, inside the 11100 s scored budget in `tests/test.sh`. This budget is unmeasured.

This package is for the owner's own model run. It has not been uploaded anywhere.
