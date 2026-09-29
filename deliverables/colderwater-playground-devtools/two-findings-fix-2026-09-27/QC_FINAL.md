# Colderwater: two platform findings repaired

Use [this ZIP](colderwater-playground-devtools.zip), SHA-256 `5d0f1d74ae48e36183c5110aee5b414fb5912aa30361401950e8a248e1e4e78b`.50 files,851,578 bytes. It supersedes63a05; previous archives remain immutable. No platform/provider attempt was used for this repair.

The earlier review was wrong on two design points. Publishing the exact three privacy probes exposed the test boundary. Requiring Duplicate/Delete for restart, and bundling three independent deletion protections, could double-penalize incomplete apps. A passing complete golden did not test either counterexample.

The public privacy note now describes private categories. Nine private representative probes cover companion/project/repository paths, allow genuine public assets and retain the source/body-inspection ban. Actual MCP tests reject a server that blocks only the former three URLs while exposing the reported other files. Eight cases/72 navigations cover the golden and valid denial/fallback/public-asset alternatives. Privacy remains a finite sample, not an exhaustive security proof; a denial-with-attachment header was exercised, but Chromium produced no simultaneous download event.

Restart now needs only independent New/Save records, exact reads and ordinary updates. It passed with Duplicate/Delete unavailable. Normal confirmation/deletion, stale-delete protection and refusal to update a deleted identity each own1.0 weight and their own records; all three passed on the golden. Missing Auto-run alone no longer poisons unrelated gates.37 Functional rows still total49.5; the scoring formula is unchanged. Fairer partial credit can increase some model scores; no new model score is measured.

All23 golden files are unchanged. Source/extraction audits each pass90/90; actual images match seven public and15 verifier files;34 known guards and30 mutation cases pass. [49-criterion evidence map](GOLDEN_CRITERION_EVIDENCE.json) explicitly separates fresh and reused observations. The ordinary restart run contains a later probe-only deletion error; the affected deletion groups were rerun separately and the original diagnostic is retained. The unavailable-feature restart is a separate successful run. These are targeted/composite local proofs, not a full hosted Oracle run.

[Privacy proof](privacy/PRIVACY_PROOF.md) · [Dependency audit](golden/DEPENDENCY_REVIEW.md) · [QC workbook](QC_FINAL.xlsx) · [All53/48 dispositions](qc_final_findings.json) · [Exact delta](change_scope.json) · [Release binding](release_validation.json).

Full hosted Oracle/model scores, provider interpretation and end-to-end judge duration remain unmeasured. Prior passes for these two findings are superseded; none of this guarantees zero future QC findings. Use the concrete counterexamples and updated prevention guide before another change.
