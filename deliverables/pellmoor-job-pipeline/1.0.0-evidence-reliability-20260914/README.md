# Pellmoor evidence reliability revision

Use [pellmoor-job-pipeline.zip](pellmoor-job-pipeline.zip) for fresh Oracle and GPT-5.4-mini evaluations.

SHA256: `bf4c04a7637abe4a5812297d8f9ff6ca51ce79a330fd579fb244ee9aff9c2232`

The uploaded browser-check runs scored Oracle **0.9572** and GPT **0.7083**. Oracle's three Functional deductions involved a lost first-page retry checkpoint, an authorization probe confounded by historical metadata, and missing individual receipts after restart. This revision repairs those verifier procedures. The golden solution already passes their corrected local checks and remains unchanged.

GPT's local capacity diagnostic also found a missed defect: a fresh second offer was accepted into a one-opening vacancy, producing **reserved=2, available=-1**. The verifier now requires the exact current-revision capacity refusal and unchanged state before awarding the existing criterion. Full details and evidence limits are in [RUN_REVIEW.md](RUN_REVIEW.md).

## Changed task files

- `tests/functional/prompt.md`: r7 instructions for capture, separate browser contexts, distinct applicant labels, persistent receipts and independent evidence.
- `tests/functional/judge.toml`: clearer capacity checkpoints, original receipt tracking, and separate historical actor-isolation/current authorization probes.
- `tests/functional/capture-loss.js`: bounded response-capture helper compatible with the pinned MCP code tool.
- `tests/functional/receipt-ledger.py`: immutable original receipt files and missing-evidence checks.
- `tests/test.sh`: helper hashes added to provenance only; the reward postprocessor is unchanged.

The 34-file upload retains version `1.0.0`. The golden solution, agent-visible task, seed, all 60 criterion IDs/types/weights, operational configuration and timeouts are unchanged. The complete diff is [source-changes.diff](source-changes.diff).

## Validation

- **139 standard checks passed** against the extracted ZIP.
- **11 golden workflow groups passed**, including response loss, exact UI retry/live view, valid Cal authorization probes and six original receipts replayed after a real restart.
- **8 ledger validation checks passed**, including incomplete captures and refusal to replace an original receipt.
- **Actual Playwright MCP helper check passed** on a synthetic transport fixture. Product workflow tests separately use the unchanged golden app.
- ZIP CRC, source/extracted byte equality, unchanged scoring, helper provenance and historical-package hashes were checked.
- The generic upload checker still fails its inherited exact `Independent judgments render` wording assertion. This is also present in the prior evaluated package; no generic upload-check or platform-QC pass is claimed.
- Exact image-build attempts are recorded in the two build logs/status files. Network failures prevent treating cached-image tests as exact-image validation.

The local wrapper's synthetic reward **0.58 is not an Oracle score**. No new platform score has been generated, and the original uploaded rewards remain unchanged.

## Rerun settings

Harbor is not authenticated in this session, so hosted runs could not be launched.

1. Run Oracle on this exact ZIP; verify every Functional criterion and Visual, targeting 1.0 overall.
2. Run GPT-5.4-mini with solver reasoning effort `high`, matching the uploaded runs. Judge effort stays `max` through the unchanged task environment.
3. Keep all original run outputs, especially verifier receipt files and provenance. Compare actual results against the 0.1–0.7 target.

Correcting false-positive capacity credit can lower GPT's score; recovering previously missing retry evidence can raise it. An in-range score is not guaranteed. Additional task hardening should follow accurate fresh evidence rather than weight changes or selective treatment of failures.

## Evidence index

- `uploaded-run-review.json`, `criterion-results.csv`, `run-file-hashes.json`: all-model results, exact criterion reasoning and the 186 uploaded-file hashes.
- `gpt-capacity-probe.json`, `gpt-capacity-probe.cjs`, `gpt-probe.sh`: isolated capacity diagnostic. It uses compatible cached dependencies rather than the exact uploaded lockfile; version differences are documented in the review.
- `golden-evidence-workflows.cjs`, `batch-regressions.json`, `runner-logs/functional-evidence/`: golden workflow and six original saved receipts.
- `capture-helper-result.json`, `cal-probe-results.json`: exact response capture and actor-probe outcomes.
- `mcp-helper-smoke.cjs`, `mcp-helper-result.json`, `mcp-tools.json`: actual pinned MCP compatibility check.
- `check-ledger.py`, `ledger-checks.json`: negative checks for the evidence helper.
- `package.py`, `package-verification.json`, `standard-qc.json`, `upload-qc.log`: package construction, checks and provenance.
- `task/pellmoor-job-pipeline/`: the extracted task; reports and diagnostic dependencies are outside the upload ZIP.

The earlier [task outline](../1.0.0-batch-offers-20260914/TASK_OUTLINE.md) still describes the unchanged product. The current criterion descriptions are in the extracted task and the complete diff above; the historical rubric map predates these evidence clarifications.
