# Ridgeline review — 28 September 2026

Candidate: [ridgeline-print-storefront.zip](review-candidate/ridgeline-print-storefront.zip)

SHA-256: `44fe09457efb5ba3976ffa352cd59681fa52fa235f9f881e02af9a850a186a22`

This replaces the earlier `e9571f7e...` candidate. The ZIP has 51 files under one safe root; CRC, executable shell modes and source/extraction hashes match. No hosted QC attempt or provider call was made.

## Changes

The rubric now has 40 Functional outcomes covering the existing 25 feature procedures. Every original feature budget is conserved exactly, totaling 35. Shared procedures run once, and each result is scored from its own observations. Basket persistence and visitor isolation; checkout review and stored transaction; duplicate-line merging and invalid-line rejection; retry identity cases; cancellation cases; and restart observations no longer share an unrelated all-or-nothing result.

Polish separates working theme switching from keyboard view navigation, keeping the previous total weight of 4 across five outcomes. Its label/focus check now reaches quantity, basket, delivery, review, unactivated order submission and lookup controls. Functional cancellation is performed by keyboard during its existing purchase/cancel flow. Visual stays at six simple Likert criteria. Overall scoring remains 60/20/20 behind the original gates/floor.

The harness now validates RewardKit detail reports before shaping a score. Missing/malformed rows, judge errors and explicit evaluator-incomplete observations produce an ungraded zero with a diagnostic. Normal product failures retain their legitimate partial grade. This does not recover a timed-out judge run or award missing credit.

Metadata is short product prose with the canonical programming category. Personal attribution, grading narrative and stale criterion counts were removed. All 19 golden/installer files and all public instructions/assets remain unchanged.

## Verified locally

| Evidence | Result |
| --- | --- |
| Current source / extracted archive assertions | 93/93 each |
| Fresh installed-MCP golden browser groups | 9/9; no page errors |
| Actual shell report-validation cases | 43/43 |
| Current-shell orchestration | 4/4, including real single-use MCP restart |
| Actual installed RewardKit schema/serialization cases | 3/3 |
| Targeted golden and duplicate-rejection mutant | Both showed the expected outcomes |
| Full QC workbook inventory | 53 quality and 48 deterministic rows answered |

The duplicate-rejection mutant correctly fails server duplicate merging while its UI merge, overstock refusal, invalid-quantity refusal and unknown-variant refusal observations still pass. This tests independent behavior; it is not an LLM grading result.

The current-shell restart test preserves the created receipt, original attempt, all thirteen stock quantities and historical receipt. The broader prior golden commerce/restart evidence is reused only for unchanged application/helper bytes; its old criterion counts are not current claims.

Quality dispositions: 42 Pass, 9 Note, 2 Not exercised. Deterministic dispositions: 34 local/manual Pass, 10 Note and 4 N-A. The private platform checker programs were unavailable. Full configured judge timing and Oracle assignment remain unmeasured. No model-score forecast or guarantee of platform acceptance is made.

## Previous five reported failures

| Reported issue | Current disposition |
| --- | --- |
| Unrequested postage-band/weight labels | Grams/band names are calculation explanations; only charge and collection-only outcome are required. |
| Unrequired display deductions | No mandated grams, band label, equal-price tie order, endpoint schema or checkout layout. |
| Bundled unrelated outcomes / mobile double penalties | Search, size, paper, title/price sort were already separate; further independent outcomes are now split. Polish owns mobile operability; Visual responsive composition excludes those observations. |
| Public CDN assets fail the gate | Public network and external browser assets are explicitly permitted. The gate restricts only external backend/data service dependence. |
| Two-browser test unavailable to configured tools | One installed MCP invocation retains the original page plus an independently created clean context. Fresh two-visitor and new-order retrieval runs pass. |

Earlier reports concerning natural voice, source-derived scoring, missing address validation, stale installer databases and mock-friendly gates were also reread. Current public prose, source-evidence prohibitions, four server address probes, safe database-reset installer and independent server write/read gate retain those repairs. Asset paths and archive contents were checked again.

Files changed: task.toml, shared app context, Functional judge/prompt, Polish judge/prompt, Visual prompt and tests/test.sh. [Exact hashes](final_binding.json), [workbook](QC_FINAL.xlsx), [all row assessments](qc_final_findings.json), [outcome/weight map](outcome_map.json), [public requirement map](requirement_coverage.json).

Separating outcomes can increase a model's deserved partial credit. Conserving weights preserves the score for wholly correct/incorrect original features, not every partially correct submission. A scenario failing all nine original heavy transactional feature groups still has the same approximate 0.606 maximum with full presentation; actual model scores remain unmeasured.
