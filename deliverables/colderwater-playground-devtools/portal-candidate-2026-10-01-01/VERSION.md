# Colderwater portal candidate 2026-10-01-01

This is a uniquely preserved **local release candidate**, not a claimed portal version. Record the portal version ID and QC result here after upload; do not overwrite this archive with a later candidate.

- Archive: `colderwater-playground-devtools.zip`
- SHA-256: `62dd342a1dd590aeee74325d9677472b0835fe7cfbf0410888bc1594d5bbf6e7`
- Source commit: `2fbbd880` (`Package latest Colderwater candidate and QC evidence`)
- Contents: 50 files under one `colderwater-playground-devtools/` ZIP root.
- Change from `2026-10-01-latest-test`: none; ZIP bytes and SHA-256 are identical. This new folder preserves the exact candidate selected for a portal check.
- Portal version ID: pending.
- Portal QC result: pending.

Quick release checks: 55/55 local structural preflight checks passed; Bash and server JavaScript syntax checks passed; all 7 TOML and 4 JSON files parsed. ZIP CRC, single-root layout, extracted file hashes, shell execute modes, public-instruction hygiene and dimension counts passed. All 50 current source hashes match the archive manifest. The fresh scripted golden run passed 79/79 mapped functional observations, both gates and 6/6 Polish browser observations; this is **not** a configured Oracle or Visual grade.

Known review limits remain: the two completed repeated local QC rounds were both `BLOCKED`, with differing reviewer verdicts on the unchanged source. The shared `test.sh` restart/readiness behavior has a controlled false-success counterexample; the public Express/SQLite requirement cannot be proved by browser-only grading; full configured judge duration and reward ranking have not been measured. Repeat round C was interrupted before reconciliation at the user's direction to prepare this candidate; it is not counted as a completed QC pass.

The candidate manifest next to this file records every shipped file hash. The source task and shared-template-controlled files were not changed for this release record.
