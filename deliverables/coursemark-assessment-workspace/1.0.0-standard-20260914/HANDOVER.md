# Coursemark release handover — September 14, 2026

## Delivery

Task: `coursemark-assessment-workspace`, version `1.0.0` (shared template version).

ZIP: `coursemark-assessment-workspace.zip`, beside this report. It contains exactly one `coursemark-assessment-workspace/` wrapper and 34 task files.

SHA-256: `e1cee8a916f2125eadf390606fe3b64960ebdbf24abc9843ace5701fadbb14ab`

Archive CRC, wrapper, file membership, per-file source hashes and exclusions passed. No databases, node_modules, caches, credentials, authoring reports or validation scripts are included. The original delivery ZIP and historical evidence remain unchanged; `source-before-standard/` preserves the pre-change source.

## Source and verifier changes

- Aligned task.toml key paths, timeouts, both Dockerfiles and runner with the current shared standard. Both agent and separate verifier use public networking. The sole credential declaration is the platform-substituted OPENAI_API_KEY placeholder in verifier.env; no key setup/remapping occurs in the runner or either Dockerfile. Native Codex judge configuration uses gpt-5.6-luna with max effort.
- Added Visual as the fifth dimension. The runner applies zero reward when Render or Constraints is nonpositive, otherwise 0.6 Functional + 0.2 Polish + 0.2 Visual. Judge/model settings remain outside the individual judge.toml files; the required [judge] tables remain.
- Preserved all 37 original criterion IDs, scoring types and criterion weights. Added six Functional criteria for successful attempt creation, numeric grading validation, positive multiple-choice authoring/key privacy, effective-due caps, manifest route documentation and actual restart persistence. Added six anchored Visual criteria. Current counts: Render 2, Constraints 2, Functional 25, Polish 14, Visual 6; total 49.
- Retained the split Polish behavior checks; moved appearance assessment into Visual. Common browser gates require a working authenticated application, reject static mocks and permit public runtime assets. Route checks discover application routes rather than mandate the golden solution's route names.
- Corrected the expiry scenario's assessment identity: AT-103 belongs to A-04, while Ben's A-01 extension is a separate check. Read-only later dimensions tolerate legitimate earlier mutations.
- Updated documented manifest/DB_PATH/restart contracts and explicit accessibility details already graded by the task. Instruction references use files genuinely present under environment/assets/instructions.
- Golden solution now exposes answer keys only to staff as intended, rejects empty/boolean/null/non-numeric rubric scores, and prevents expired submission payloads from replacing saved answers. Expired seeded attempts are settled once at startup, avoiding dependence on which dimension reads first.
- Golden browser fixes: blank grading inputs are rejected, stale-tab conflict refresh updates displayed records as well as revision, and written-answer fields have accessible labels.
- Exactly one lifecycle helper and one final restart criterion are included. No task requirements were removed to improve scores.

## Fresh unpaid validation

All results below concern this release, not historical Oracle/model results.

- 128 shared standard checks passed: `standard-check.json`.
- 17 local regression groups passed: `regressions.json` and `local-run-attempt5.log`. These include authentication/privacy, deadline/extension math, availability, browser save/reload/submit, score validation, browser grading/release, authoring/publication, successful and duplicate starts, MC key privacy, effective-due caps, audit order, stale-tab recovery, pending-click protection, keyboard/mobile/reduced-motion behavior, session revocation and actual process restart with persisted records and operation receipts.
- Bash syntax checks passed for solve.sh, test.sh and app-lifecycle.sh. Node syntax checks passed for server.js, browser app.js and the local regression harness.
- Actual test.sh startup readiness, lifecycle execution, prompt provenance and reward/CTRF output were exercised using an unpaid local RewardKit stand-in. Its synthetic reward of 0.58 is solely a runner fixture, NOT an Oracle or model score.
- Ten reward postprocessing cases passed, including all-one, both zero gates, partial-positive gates, missing scores, booleans, NaN, infinity, out-of-range values and strings.
- Final-run prompt/judge hashes match packaged source. Original seed bytes and all prior criterion IDs/types/weights were checked against the preserved baseline. ZIP verification details: `package-verification.json`.

## Remaining validation and risks

Fresh agent-image build failed because the configured local proxy hostname could not resolve. Fresh verifier-image build failed on PyPI dependency download timeouts. See agent-build.log and verifier-build.log. Neither fresh Dockerfile build is claimed to pass.

Browser and API regressions ran in cached image coursemark-tests:1.0.17, against the current source and current runner, with a local Chromium path shim. This validates application/runner behavior, not complete fresh-image reproducibility or the paid judge toolchain.

No paid Oracle/model run or platform rubric QC was launched. No current Coursemark platform run exports were available for this review. Local regressions are not an execution of every natural-language judge step, and screenshots are not a predicted Visual score. Platform QC and Oracle remain necessary; Oracle 1.0 is not guaranteed.

Earlier local harness attempts are preserved for traceability. Initial failures were test locator ambiguity and an asynchronous navigation assertion; those harness issues were corrected. The final attempt passed all 17 groups.
