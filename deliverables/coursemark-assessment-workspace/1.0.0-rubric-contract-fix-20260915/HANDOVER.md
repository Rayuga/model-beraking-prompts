# Coursemark rubric-source QC repair ? 15 September 2026

Upload `coursemark-assessment-workspace.zip` from this directory.

SHA-256: `856cb5fae457c31a4374a109ee3609c691cf6eb8d6dc331891b2b66082f0ed1e`

## Corrections

Only `tests/functional/judge.toml` changed, in two criterion descriptions:

- `start_attempt_and_single_active_guard`: removes the automatic grader-assignment requirement. A new attempt may remain unassigned. `attempts.md` specifies eligibility, timing and single-active behavior; `grading.md` allows an instructor to grade any submitted course attempt and limits the TA to assigned attempts. None requires automatic assignment. All existing timing, privacy, revision, reload, replay and duplicate-start checks remain.
- `audit_visibility_and_exactly_once_events`: replaces the ambiguous ?fail only? exception with four explicitly mandatory observations: exactly one event for each accepted operation; no event for rejected/replayed operations; the documented role visibility; and ordering/count preservation after reload. A staff-authored event on a student's own attempt is valid ownership evidence, but never excuses duplicate events, invalid-operation events, another student's events or failed persistence. These obligations come from `records.md` and `grading.md`.

All 66 criterion IDs, types, weights and order are preserved. Golden solution, seed, instructions, prompts, runtime, timeouts, task version and reward configuration are byte-identical to the previous browser-recovery delivery. Prompt markers stay unchanged because prompt text did not change; the new judge hash is recorded in the verifier provenance and package report. This repair retains the prior browser recovery work.

## Validation

- Source and extracted archive: 145 standard checks passed each.
- Actual upload ZIP: 423 archive checks passed, 39 files under one task wrapper.
- Actual reward postprocessor: 10 cases passed, including invalid/missing scores and gate behavior.
- Packaged source: all five dimensions loaded and completed in the real RewardKit runner using a synthetic CLI fixture on cached `coursemark-tests:1.0.17`. This validates parsing, transport, evidence/provenance and aggregation only. Its synthetic reward is not an Oracle score.
- Source hashes, archive bytes and runtime provenance agree. Parsed comparison confirms only the two descriptions changed.

Both exact Docker image builds were attempted. The verifier build failed after repeated PyPI read timeouts; the agent build was canceled after Debian mirror requests stalled. Fresh image validation remains incomplete. Build logs are preserved alongside this report. Application regression tests were not repeated for this wording-only change.

Platform rubric-source QC and a full Oracle run have not been performed on this ZIP. Rerun QC on this exact archive and then Oracle; no passing hosted QC result or new Oracle score is claimed.

Evidence: `changes.diff`, `baseline.json`, `package-verification.json`, `standard-check.json`, `extracted-standard-check.json`, `upload-check.json`, and `integration/integration-validation.json`.
