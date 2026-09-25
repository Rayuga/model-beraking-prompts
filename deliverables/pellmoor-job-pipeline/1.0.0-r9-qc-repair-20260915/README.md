# Pellmoor r9 QC repair

Use [pellmoor-job-pipeline.zip](pellmoor-job-pipeline.zip) for the next platform QC and Oracle run.

SHA256: `f80e2031248270b5e095ab172887e8ec420104556a1a9f1056003022aa29454f`.

This revision addresses the five reported rubric findings: repeated verification work, unrequested requirements, appearance credit for apps with no working writes, poor weighting of the core pipeline, and inconsistent weight/seed definitions. It also corrects the pinned RewardKit version's handling of zero-weight gate dimensions.

Local validation passed: 14 golden workflow groups, four actual-MCP golden note checks, two negative write fixtures, 11 scoring/runtime cases, 139 standard checks and 408 archive checks. The golden solution, 60 criterion IDs/types, task version, timeouts, model/effort and final reward formula are preserved. Functional criterion weights are intentionally rebalanced and documented.

Read the [QC repair report](QC_REPAIR_REPORT.md), [package provenance](package-verification.json), [criterion and weight audit](../../../reports/pellmoor-job-pipeline/2026-09-15-r9-qc-repair/RUBRIC_REVIEW.md), and [timing plan](../../../reports/pellmoor-job-pipeline/2026-09-15-r9-qc-repair/TIME_BUDGET.md).

A fresh hosted QC/Oracle run is still needed, including evidence that the full judge journey fits the configured budget. Local regression results are not Oracle scores. Exact image builds are recorded separately in the repair evidence; dependency-download failures must not be mistaken for successful exact-image validation.

`package-attempt-1/` preserves an earlier local package that failed identical-network-policy wording QC. Its ZIP is superseded. Use only the ZIP linked above. Historical r8 and uploaded model runs remain unchanged.
