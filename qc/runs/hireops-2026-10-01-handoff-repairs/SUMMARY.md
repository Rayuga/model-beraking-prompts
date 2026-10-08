# HireOps repaired candidate — 1 October 2026

**REVIEWABLE, BLOCKED FROM CLEARANCE.** Confirmed task-specific findings are repaired. Shared-template defects and missing configured measurements remain. No Oracle, Luna or portal result is claimed.

The final ZIP matches all 35 live source files and the exact source recorded by the final focused checks. It contains one correct root, passes CRC/extraction comparison, and preserves 0755 modes on both shell files.

- ZIP: `deliverables/hireops-recruiting-operations/2026-10-01-handoff-repaired/hireops-recruiting-operations.zip`
- SHA-256: `4ff19f35df5121c8a741cd7399bd7f6481d47a4606c7f666c20ea94b3b72b23b`
- Size: 100,211 bytes; 35 files.
- Criteria: 145 Functional, 14 Polish, 6 Visual, and two one-criterion gates.
- Criterion weight totals remain 45 Functional, 9 Polish and 6 Visual. Shared 60/20/20 dimension weighting is unchanged.
- Exact binding: [FINAL_STATUS.json](FINAL_STATUS.json), [candidate manifest](../../../deliverables/hireops-recruiting-operations/2026-10-01-handoff-repaired/candidate_manifest.json), [image/archive binding](local-final/input-binding.json).

## Starting state and completed audit

The workspace began clean on `main` at `2d6071cf19b215791a3416d679638d3b0367e3e1`. All 35 initial live files exactly matched the newer `2026-10-01-current` manifest and its ZIP, SHA-256 `1ce5e2af6a125d259f73a4c5171dfde0285832f91bdf09704b8f02ac7a070b51`, 94,867 bytes. Its actual counts were 86 Functional, 14 Polish, 6 Visual and two gates. The round7 handoff was not used as current evidence.

The audit used `qc_pipeline.py prepare --mode single-per-row`: 53 fresh independent quality reviewers and one separate reviewer for all 48 deterministic rows, batched within available concurrency. All 54 reports were valid and complete when reconciled; preflight passed and the result was BLOCKED. The deterministic review applied the recipes manually with cited local/source evidence; private portal checker executables were unavailable.

See the immutable [round summary](../hireops-2026-10-01-handoff-audit/SUMMARY.md), [reconciliation](../hireops-2026-10-01-handoff-audit/RECONCILIATION.md), and [workbook](../hireops-2026-10-01-handoff-audit/QC_REVIEW.xlsx). A generated Python cache file was preserved outside the frozen rules; all frozen task/rule hashes remain intact. No credible failure was outvoted or waived.

That complete round applies to the pre-repair bytes. It is not clearance for this changed candidate. After repairs, a focused independent credit review found three refinements; all were accepted and independently confirmed closed. Its [original findings](focused-credit-review.json) and [closure](focused-credit-closure.json) are retained. No second full audit round was started while known shared and measurement blockers remain.

## Task repairs

- Replacement-grant checks now compare fair and strike prices on the grants themselves, including historical values. Optional-claim/session-authority checks cover requisition creation, offer creation, approval, revision and rescission, with observed valid controls.
- Claimed tier has one approval owner. Unusual-ID creation, approval, revision and rescission have distinct owners; later routing failures cannot erase successful creation credit.
- Account support, role permissions, all nine tier/band decisions, identity policies, date acceptance/refusal and dashboard transitions now retain independent credit. Existing weight pools are divided, with only a sub-millionth rounding residual, and browser observations are reused rather than replaying entire protocols per criterion.
- Anonymous HTTP401 policy is separate from confidentiality of each data family. A shared bootstrap is replayed once; an offer-only leak does not erase credit for protected equity/referral/audit data.
- Each scored prompt explicitly establishes minimal backend persistence through UI creation and fresh empty-context readback. The storage gate may use another working authorized account; approvals and advanced compensation remain scored outcomes.
- Stale gate-state/approval wording is corrected. Render and Visual explicitly distinguish evaluator limitations from observed app failures. Visual uses raw Likert1 for normalized zero. Both natural and deliberately delayed loading observations require successful completion.
- Public task notes disclose the actual working directory, unprivileged/copy launch and supplied environment. Requisition-claim checks do not invent a creation-audit requirement. Dashboard criteria compare actual persisted ledger/status facts instead of regrading settlement formulas.

Nine task files changed. Every golden-solution file, the seed, task/model settings, shared harness, shared scorer/reward policy, Dockerfiles, integration note and timeout settings remain byte-identical to the starting candidate. The external packaging helper's HireOps count assertion was updated from 86 to 145; it still enforces the exact total weight and archive checks.

## Measured evidence for the final bytes

| Evidence | Measured result and limit |
|---|---|
| Structural checks | Passed current local preflight, TOML/JSON/schema identifiers, criterion references, public-content hygiene, template equality and weight checks. Not the private 48-check suite. |
| Docker builds | Agent and verifier build successfully. Actual image contents match the relevant final source hashes. Builds were largely cached; no cold-build duration claim. |
| Golden domain checks | 77/77 assertions pass, including exact arithmetic, full authority matrix, revisions/rescissions, atomic concurrent operations, referral/date rules, authorization and actual direct process-restart durability. |
| Browser checks | 16/16 pass in the configured Linux Chromium installation, including unusual IDs, exact large money, all revision inputs, recovery, mobile screens and no JavaScript errors. |
| Coverage counterexamples | Golden passes; disposable stale-grant-price and forged-revision-role mutations expose the intended defects while preserving unrelated observations. No reward scores. |
| Storage-gate witnesses | Golden and a dead-approval variant satisfy basic persisted creation/readback; an HTTP-success no-op creation variant fails it. No configured gate verdict. |
| Installed configured-parser path | RewardKit 0.1.7 resolves all five prompts and schemas. Final Functional prompt is 115,600 bytes with 145 criteria; configured CLI arguments launch successfully using `/usr/bin/true`. No judge/provider invocation. |
| Archive | Final ZIP, manifest, live source, final test provenance and installed parser inputs match exactly; shell modes and CRC pass. |

Raw commands, process exit codes, durations and log hashes are in [verification-final.json](verification-final.json). Source/structural results are in [structural-final.json](structural-final.json). Earlier focused attempts remain under `local/`; final artifacts are under `local-final/`. Initial PowerShell build wrappers returned misleading exit codes while Docker completed; subsequent direct subprocess builds recorded actual exit0, with both logs retained.

The pre-repair actual MCP feasibility, normal installer/restart lifecycle and mutation witnesses remain supplementary evidence for unchanged components. They are not silently relabelled as full runs of the revised candidate.

## Remaining blockers

1. **Shared restart/cleanup defects.** The unchanged canonical helper can report success while a SIGTERM-resistant old process remains alive and the replacement fails with `EADDRINUSE`. Final cleanup can wait indefinitely on that process. These were reproduced with actual shared scripts in a network-disabled fixture; final shared-file hashes match those tested bytes. Initial zero reward survives, but that does not make cleanup bounded or the restart proof valid. See [raw fixture](../hireops-2026-10-01-handoff-audit/local/shared-harness/results.json).
2. **Shared policy proof limitation.** Browser evidence establishes behavior and backing but cannot prove mandated backend technology, internal DB_PATH use or the absence of an outside backend. Resolving that requires an authorized policy/tool change, not task-local source inspection or a hidden criterion.
3. **Missing configured measurements.** No full `z-ai/glm-5.3-flashx` grade/duration, Oracle grade, `gpt-5.6-luna` build/grade, or configured weak/partial/strong reward distribution/ranking has been measured. The four required runtime clearance records remain absent. Functional stays at 9000 seconds, whole verifier at 13200 and builder at 7200; no measured reason supports changing them.

No provider spend, upload or external message occurred. Shared-owner fixes and authorized configured measurements are required before clearance; the resulting exact candidate also needs a fresh complete audit. This package is for review, not a promise of Oracle1, a Luna score or portal acceptance.
