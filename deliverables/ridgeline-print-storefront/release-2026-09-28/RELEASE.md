# Ridgeline current candidate

This release supersedes the earlier review-only candidate. The user clarified that task-specific prompts can change even without `CHANGE_ME`; the earlier blanket freeze interpretation was too broad.

Changes since the full review:

- Restored fixed metadata tags to the template list.
- Expanded the existing mobile usability criterion to cover catalogue, detail, basket, delivery fields, the order-submission control, lookup and receipt. It requires no purchase/cancellation and does not change weights or regrade business rules.
- Corrected the packaging helper's stale criterion-count assertions.
- Rebuilt the ZIP and updated the top-level `ridgeline-print-storefront-final.zip` to identical bytes.

The seven shared harness/configuration files are byte-identical to the template; all five judge headers, timeouts and verifier settings match. No golden-solution code changed.

Evidence:94 local source assertions pass; the exact mobile proposal applied here passed20 browser assertions on the golden. All53 quality and48 static-requirement dispositions are recorded in `QC_REVIEW.xlsx` and `qc_findings.json`. No confirmed local finding remains open; full judge duration and Oracle/model scores are explicitly unmeasured. Local/manual review does not guarantee hosted QC acceptance.

Archive: `ridgeline-print-storefront.zip`,51 files. CRC, safe root, executable shell modes, public hygiene and all extracted SHA256 checks passed.

SHA256: `14cd3d3ad888f702fcfb39f650e59aecf9a86934badc06744ff4839c4ccb05e4`
