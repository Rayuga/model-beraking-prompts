# GridForge 2.0.9 Readiness Fix

Upload `gridforge-spreadsheet-v2.zip` from this folder, not the older 2.0.8 ZIP.
It contains one `gridforge-spreadsheet-v2/` wrapper with 32 task files.

The platform's static `check-verifier-contract.py` reported no readiness probe
in `tests/test.sh`. The lifecycle helper already performed an HTTP wait, but
the checker apparently did not follow that helper call. This release adds a
real bounded curl readiness wait directly before RewardKit in `test.sh`, with
curl explicitly installed in the verifier image. Either `/health` or `/` may
establish readiness. Exhausting the wait exits without starting grading.

Public agent and verifier networking, separate verification, and all 44
criteria and their weights are unchanged. The golden application code is also
unchanged. Dependency metadata corrupted by earlier release-version replacement
was restored in package-lock.json, and an isolated npm ci succeeded. Future
version bumps must update only the root package versions, not dependency data.

Validation for this release:
- 34 local structural checks passed.
- Root-only server and delayed startup passed the actual readiness gate.
- An unavailable server exhausted the wait and did not reach grading.
- All 24 existing local golden regression groups passed again.
- Empty-submission reward remains 0.0.
- The repaired lockfile passed npm ci with install scripts disabled.
- ZIP files are byte-compared with source and hashes recorded in qc-preflight.json.

This is not a fresh platform static/QC pass or an Oracle score. The platform
checker source is unavailable locally, and no paid run was started. Re-upload
this archive and rerun platform checks. Previous release evidence is preserved.
