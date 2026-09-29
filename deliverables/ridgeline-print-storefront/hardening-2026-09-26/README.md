# Ridgeline local candidate — 26 September 2026

The downloaded print-shop task has been hardened and its golden app rebuilt. This directory is the external evidence pack; only `ridgeline-print-storefront.zip` is the task upload candidate.

## Deliverables

- [Task ZIP](ridgeline-print-storefront.zip): one matching root, 51 files, 694,989 bytes; SHA-256 `d39e1668a4233689bd51e99d1d043f6c9b191ab854edfc730cacbdcabe343860`.
- [Candidate manifest](candidate_manifest.json): every source-file hash, archive CRC/extraction checks, executable shell modes, and actual criterion counts.
- [Final QC workbook](QC_FINAL.xlsx) and [QC summary](QC_FINAL.md): all 53 quality checks and all 48 deterministic-checker procedures accounted for. The client checker executables are not supplied; manual equivalents are identified.
- [Fairness ledger](FAIRNESS_LEDGER.md), [test coverage](TEST_COVERAGE.md), and [frontend validation](FRONTEND_VALIDATION.md).
- Fresh golden preview: http://localhost:3310, container `ridgeline-preview`. The two validation containers have been stopped. The preview begins with the original eight prints, thirteen variants and 83 stocked units.

## What changed

The functional rubric now contains 16 binary criteria with total internal weight 35. Eight criteria carrying adversarial or replay probes hold 21 of that weight (60%, versus 8.33% in the downloaded baseline). Dimension shares remain 60% functional, 20% polish and 20% visual, behind the standard gates and functional floor.

The shop's explicit notes now cover duplicate variant aggregation, whole-sheet quantities, atomic multi-line stock checks, concurrent purchases of the last copy, distinct checkout attempts versus retries, immutable charged receipts, and cancellation restoring stock exactly once. The golden implements these transactions and their browser flows. Every refusal probe has a valid control and observes the affected state afterward.

The verifiers accept legitimate API shapes, safe refusal responses, and either authoritative repricing or rejection of forged monetary values. Checkout may use one screen or several. Independent state allocations and a self-contained persistence setup reduce cascading failures.

The frontend has editable React source and local assets, responsive light/dark presentation, keyboard navigation, and recovery of an unresolved checkout even when its successful purchase exhausted stock. Pending recovery retains the original payload and prevents an edited basket/address from silently creating another order.

## Local evidence

| Evidence | Result and scope |
|---|---|
| `backend_smoke_results.json` | 203/203 API/SQLite assertions passed, including refusals, duplicate aggregation, concurrent orders, cancellation and actual process restart. |
| `rubric_math_results.json` | 19 independent seed-derived arithmetic cases passed. |
| `ui-evidence/browser-results.json` | Nine grouped browser checks passed. |
| `ui-evidence/browser-resilience-results.json` | Five additional grouped browser checks passed, including lost last-unit response, blocked pending edits, modal Escape/focus, mobile checkout and keyboard-only purchase. |
| `scorer_results.json` | 13 canonical scorer fixtures passed, including gates, floor boundaries and invalid input. |
| `harness_results.json` | Four real `test.sh` runs with a local synthetic judge stub passed: relative-path app, golden persistence, gate failure and missing app. Synthetic scores are not Oracle results. |
| `browser_mcp_runtime.log` | The exact shipped Playwright MCP/Chromium 152 performed navigation, responsive inspection, in-page requests and request interception successfully. |
| `agent_image_evidence.json` | Clean agent app directory, all seed/photos, pinned dependencies and no solution/verifier leakage. |
| Image build logs | Both final Dockerfiles built successfully. |
| `candidate_manifest.json` | ZIP CRC, one root, shell modes and every extracted file hash passed. |

## Lessons confirmed in the actual runtime

Both initial launch and restart must change to the app entrypoint directory before running Node. The previous `/tests` working directory breaks normal relative static paths. A UID-65534 relative-path fixture passed startup and the actual single-use restart tool after this correction.

RewardKit 0.1.7's `Likert(points=5)` requests raw values 1–5 and normalizes `(raw - 1) / 4`. The visual rubric now agrees: raw 1 means zero normalized credit. Its six presentation criteria remain intact. See `rewardkit_runtime_source.json`; canonical scorer and restart tool code are unchanged.

The current Playwright MCP exposes `browser_run_code_unsafe`, rather than the older `browser_run_code` name, and also exposes `browser_evaluate`. Discover the actual tools; the task prompts do not hardcode the obsolete name.

The breaker helper still reports a failure because it searches for a literal command deleting the app database before grading. That command is absent from the supplied staged template too, and would undermine durability. This is a documented helper/profile mismatch, not a reason to delete the database. Its keyword-based enforcement estimate is 64.3%; the explicit ledger's eight probe criteria total 60%.

## Measurement and next task

No paid Oracle, GLM aesthetic judging or Luna builder run was performed. Local checks do not establish an Oracle score of 1.0 or a target-model score. The current supplied standards use `gpt-5.6-luna` as the builder and `z-ai/glm-5.3-flashx` through the `claude-code` judge runner. Measure the packaged candidate before claiming acceptance or tuning difficulty further.

The suggested second task is **Tableturn Restaurant Reservations**, subject to reviewing its downloaded brief. Table capacity, overlapping bookings, cancellations and availability changes can provide clear business boundaries and reproducible competing requests without an external service.

`downloaded-baseline.zip` preserves the exact input before this work. `prepare_seed.py` records the one-time CSV conversion and expects that original baseline; it is not a final-candidate startup command. All validation scripts, reports, screenshots, baseline files and extracted archive checks remain outside the task ZIP.
