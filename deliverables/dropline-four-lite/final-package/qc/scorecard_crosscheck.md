# DropLine Four Lite scorecard cross-check

Reviewed against the root QC scorecard and upload-check guidance on 2026-09-04.
This report is supporting evidence and is not inside the task ZIP.

## Delivery evidence

- Final task: `turing/dropline-four-lite`, version 6.0.3.
- Shared run checksum:
  `c7400c4c34da652f7e4d050c40a063e4aa4fd4ffeacd3b6aa4ecd092d10aa528`.
- Oracle: 1.0000 — all 22 criteria and all 13 Functional criteria passed.
- GPT-5.4-mini: 0.5390 — Constraints 1.0, Functional 0.6316, Render 1.0,
  Polish 0.4, graded 1, no-op 0, no exception, agent `FINISHED`.
- Claude Haiku 4.5: 0.3327 — Constraints 1.0, Functional 0.4211, Render
  1.0, Polish 0.2, graded 1, no-op 0; all 22 criteria have reasoning.
- No-op: 0.0000 with `no_op=1`.
- Clean platform archive: 28 files beneath one `dropline-four-lite/` wrapper,
  with no backslash entries or excluded authoring/runtime files.
- Task and verifier networking: `public`.
- Documented upload checks: 26/26 pass.
- Run-evidence checks: 9/9 pass.
- Source-decidable checks: 18/19 pass.
- Formal RL scorecard: 50/58 (86.2%), Conditional Accept.

## Run validity

- Oracle and GPT have no exception, timeout warning, or empty reasoning.
- GPT used the unmodified exact v6.0.3 package and completed normally; its score
  is inside the required 0.1–0.7 band.
- Haiku built a substantive artifact and completed all verifier dimensions
  without judge timeout. Harbor records a model-caused exit-143 exception after
  Haiku used `pkill -f "node /app/server.js"`, which also matched OpenHands.
  The exception and trajectory are retained in its evidence archive.
- Invalid older v6.0.2, no-allowlist, detached-verifier, timeout, and no-op GPT
  results are not used as final evidence.

## Remaining scorecard limits

- The packaged `solution/app/server.js` contains mixed LF/CRLF line endings,
  so its raw hash differs from the LF-normalized hash recorded in task metadata.
  The scored package was not silently changed after the runs.
- The Windows-created ZIP records both shell scripts as mode `0666`; this was
  non-blocking because the verifier image applies `chmod +x` and every exact
  package run executed successfully.
- Eight independent target-model rollouts and three repeated scorings of one
  artifact were not requested, so distribution and repeatability statistics
  remain unmeasured.
- Browser reload and later sign-in persistence are tested, but process-restart
  durability is not mechanically asserted.
- Same-origin behavior is verified, but the exact Express/SQLite stack is not
  mechanically inspected.
- Base images are tag-pinned but not digest-pinned. Apt package names remain
  intentionally unversioned, as required by the documented upload check.

The baseline-hash discrepancy requires follow-up before claiming completely
clean source QC. It does not alter the verified Oracle result, in-band GPT
score, exact task checksum, or package structure.
