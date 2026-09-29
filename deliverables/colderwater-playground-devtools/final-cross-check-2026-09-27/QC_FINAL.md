# Colderwater final cross-check — 27 September 2026

Use this replacement [ZIP](colderwater-playground-devtools.zip), SHA-256 `63a05a5e4ebf9501fd520067df33db2510f7198300be566049ee28058a18da64`. It supersedes a017; the old archive remains immutable. The replacement contains 50 files and 849,815 bytes. No platform attempt or paid judge/model call was used.

The independent pass found another real harness compatibility bug and several concrete fairness/coverage gaps. Those are fixed. The report does not certify zero future QC findings or Oracle1.0.

## What changed

- Installed RewardKit omits empty reasoning. The report validator now accepts that schema-valid output while still rejecting evaluator errors, incomplete markers and explicit nonstring reasoning.
- Pending preview changes can stay hidden; further input can be temporarily blocked. The verifier measures the original deadline and retained/restored state without forcing a golden-specific display/input policy.
- Existing checks now prove successful trimmed titles, rollback to the latest successful interaction, Stop after completed execution, and separate saved copies of built-in examples.
- Only four verifier files changed. Golden23 files, public notes, IDs, weights, provider, canonical helpers and timeouts are unchanged;35 Functional criteria still total49.5.

See [exact scope](change_scope.json), [semantics before/after](semantics/independent-semantics-review.md), and [actual CLI/harness review](harness/HARNESS_REVIEW.md).

## Evidence

- Source90/90 and extracted90/90 local assertions; actual rebuilt images match seven public and15 verifier files.
- 29 narrow regression guards and24 mutation fixtures, including22 known bad contracts rejected.
- 10 installed-CLI outcomes,43 report-guard fixtures,4 orchestration cases and39 harness bindings.
- Fresh golden browser flows for the changed outcomes and two valid static-overlay alternatives; five-group continuous save/restart/conflict proof. [Current47-criterion evidence map](golden/GOLDEN_CRITERION_EVIDENCE.json) distinguishes fresh and hash-bound reused evidence.
- [All53/48 dispositions](QC_FINAL.xlsx), [machine findings](qc_final_findings.json), [manifest](candidate_manifest.json), [image binding](final_image_evidence.json), and [final release assertions](release_validation.json).

## Remaining limits

Full hosted Oracle/model scoring and end-to-end judge duration are unmeasured. Local transport fixtures test RewardKit plumbing, not the semantic provider judge. The private platform checker implementation was unavailable; deterministic checks are local/manual equivalents. Timing witnesses retain normal scheduling assumptions, and reserved-URL checks are finite denial/fallback observations, not exhaustive security proofs. No concrete unaddressed material blocker was established in the bounded review.

The previous missing-reasoning negative fixture was wrong and is superseded by real CLI evidence. Earlier claims of complete compatibility based only on those mocks should not be reused. A browser probe's initial example-source extraction error was corrected and retained in evidence; it did not require an app repair.

Use the exact ZIP linked above if submitting. Keep the second remaining platform attempt for any actual platform-specific feedback; this review consumed neither.
