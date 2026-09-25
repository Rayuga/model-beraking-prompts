# Pellmoor browser completion check — 14 September 2026

Upload `pellmoor-job-pipeline.zip` for the next Oracle and GPT-5.4-mini evaluations.

SHA256: `53204d77b3d9a79c35642ee7999d1878630735fccec462c2c12a75cdbf28ce06`

Only `instruction.md` changed. Its new completion guidance asks every solver to start the shipped server, verify scripts/styles in a real browser, sign in, open a vacancy and candidate, reload, check for fatal errors, and repeat after final edits. This clarifies how to verify the existing working-browser requirement. It adds no rubric criterion or model-specific hint.

The 32-file archive retains task version `1.0.0`. All five verifier prompts and configurations, all 60 criteria and weights, reward formula, timeouts, seed data, domain rules, Dockerfiles, and golden solution are byte-identical to the previous batch package. See `instruction-change.diff` and `package-verification.json`.

## Validation

- All 139 standard checks pass against the task extracted from this ZIP.
- ZIP integrity and exact equality between source and extracted contents pass. The only changed file relative to the previous frozen package is `instruction.md`.
- Local browser smoke passes using the extracted golden solution in cached `pellmoor-tests:2.0.3`: its referenced script returns JavaScript with the correct content type, login populates the vacancy, candidate details open, reload and reopening work, and no fatal browser errors occur. Golden styles are embedded in the HTML. This is a local check, not an Oracle score.
- The generic `check-upload.py` fails its literal `Independent judgments render` wording assertion on both this ZIP and the previous Oracle-tested ZIP. Existing prompts use different continuation wording. Their bytes have not changed; no generic checker pass or platform QC approval is claimed. Changing verifier wording would be a separate revision.
- Exact image build attempts and their outcomes are recorded in `environment-build-status.json` and `verifier-build-status.json`. The environment attempt fails resolving the configured package proxy; the verifier attempt encounters PyPI timeouts. The cached-image smoke does not substitute for those builds.

## Fresh runs required

Harbor is installed, but `harbor auth status` reports `Not authenticated`. Fresh hosted Oracle and GPT runs could not be launched from this session.

Run Oracle and GPT-5.4-mini with solver reasoning effort `high`, matching the earlier GPT setup, on this exact ZIP. Judge reasoning remains `max`. Keep each attempt and its original outputs. Oracle should be checked for 1.0 overall and Visual; evaluate whether a working GPT submission falls within 0.1–0.7. The completion guidance cannot guarantee an in-range score.

The previous package's Oracle 1.0 is historical evidence for the unchanged golden/verifier files, not a fresh score for this archive. Its two GPT attempts scored 0 for distinct UI delivery defects: a date-field mismatch and missing static asset serving. Gemini was 0.7940, Haiku 0, and no-op 0. Existing judge-evidence gaps in the Gemini review remain unresolved by this instruction-only change.

## Supporting files

- `task/pellmoor-job-pipeline/`: exact extracted task directory.
- `package.py`: immutable package construction and verification.
- `instruction-change.diff`: complete task change.
- `package-verification.json`, `standard-qc.json`, `upload-qc.log`: checks and provenance.
- `browser-smoke.cjs`, `browser-smoke.sh`, `browser-smoke.json`: local browser check and result.
- `build-image.py` and build logs/status files: exact-image attempts.
- [Previous implementation and validation](../1.0.0-batch-offers-20260914/IMPLEMENTATION_REPORT.md).
- [Unchanged task outline](../1.0.0-batch-offers-20260914/TASK_OUTLINE.md) and [rubric map](../1.0.0-batch-offers-20260914/RUBRIC_MAP.md).
- [All-model platform review](../1.0.0-batch-run-review-20260914/RUN_REVIEW.md) and [second GPT diagnosis](../1.0.0-gpt-rerun-review-20260914/RUN_REVIEW.md).

Reports and authoring scripts are outside the upload ZIP. Historical packages and run outputs remain untouched.
