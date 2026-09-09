# PatchPad 2.0.6 readiness repair

The supplied platform screenshot reports 44/45 static checks, with
`check-verifier-contract.py` claiming no readiness probe before grading.
Version 2.0.5 already waited in `app-lifecycle.sh` for `/health` or `/` for
45 seconds. The reported finding appears to miss that delegated check;
the platform checker source is not available locally to confirm its matcher.

Version 2.0.6 adds an explicit HTTP readiness loop in `tests/test.sh`, after
managed startup and before RewardKit. It requires the browser entry `/` to
return successfully, retries on connection/HTTP errors for a 60-second
deadline with 2-second request timeouts, and logs attempts. Failure retains
zero rewards, skips the judge and cleans up the managed process. Python's
existing standard library is used; no extra dependency is installed.
The lifecycle helper and single restart criterion remain unchanged.

Compared byte-for-byte with the historical 2.0.5 ZIP, all other changes are
release markers only. Golden logic, instructions, prompts apart from version
comments, all 35 criteria, their weights, and reward aggregation are unchanged.
Both agent and separate verifier networking remain public.

## Fresh unpaid checks

- Both final Docker images built successfully using cached dependency layers.
- Shell syntax, golden JavaScript syntax, JSON/TOML parsing and RewardKit
  discovery passed: 2 Render, 2 Constraints, 27 Functional, 4 Polish.
- Empty submission returned zero without a judge call.
- Manifest parser accepted 5 valid cases, rejected 6 invalid cases, and
  preserved an unrelated backup file.
- 22 browser regression groups passed: 6 QC/focus/conflict, 6 smoke, 2
  restart/route documentation, and all 8 previous Oracle-failure paths.
  These are overlapping regression groups, not a score for all 35 criteria.
- Actual runner with a trusted local score stub passed two restarts, unchanged
  aggregation and final process cleanup. The injected score is not an Oracle.
- Actual runner delayed-bind fixture passed after 7.57 seconds.
- Healthy API with delayed browser entry passed after 7.95 seconds; the stub
  verified the entry was actually ready before it could grade.
- Permanently unavailable entry skipped the judge and cleaned up after 63.45
  seconds, including startup/cleanup overhead.
- Crashed startup skipped the judge and cleaned up after 45.73 seconds.
- Exact 30-file allowlist, LF/UTF-8, historical ZIP preservation, unchanged
  criteria/weights, version markers, archive CRC, wrapper and source hashes
  passed in `package.py`. Reports and validation scripts are outside the ZIP.

An abandoned intermediate curl-based build failed because the local Docker
proxy hostname could not resolve. That change was reverted; both final images
build successfully with existing dependencies. A clean uncached dependency
download was not tested.

## Delivery and limits

ZIP: `patchpad-editor-v2.zip`, containing only `patchpad-editor-v2/` and 30 files.

SHA-256: `327efa72fead8f10b71c90d5777bb980a685acbe058512b6d933af242730a144`

No paid Oracle/model or actual platform static checker was run. Upload this
new ZIP and rerun platform QC, then Oracle. This repair does not establish
an Oracle score of 1.0. Previously documented network-policy and rubric
interpretation risks remain; see the historical 2.0.5 preflight reports.
