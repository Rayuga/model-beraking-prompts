# Ridgeline second rubric correction — 26 September 2026

Current archive: [ridgeline-print-storefront.zip](ridgeline-print-storefront.zip), 51 files, 699,956 bytes.

SHA-256: `7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6`.

This replaces the `f8a9b605…` candidate. The latest screenshot reports five failed judgments, with the first two identifying the same hidden display requirement. That wording was still present in the previous correction; the earlier corresponding PASS judgments were too broad. Original reports and archives remain preserved.

## Findings and changes

| Platform finding | Assessment and correction |
| --- | --- |
| Instruction states deliverables/runtime contract | Genuine: two receipt checks demanded a postage-band label or grams without a public request for that display. The verifier now checks the required monetary amounts; grams remain calculation inputs only. |
| No criterion grades the unrequired | Same display defect. A correct receipt saying only `Postage £4.95` or `Postage £3.20` is accepted when its arithmetic and other requested facts are correct. The brief was not expanded to require extra decoration. |
| Criteria are independent | Search, size filtering and paper filtering now have independent outcomes at 0.1 each; price and title sorting at 0.15 each. Combined weight remains 0.6. Mobile reachability/overflow stays in Polish; Visual compares composition across widths, with the other five visual criteria assessed at desktop width. |
| Global browser gate | Genuine standards conflict: public network and external browser assets are allowed in the current template. Removed the old CDN/font/image penalty and aligned the brief, integration note and gate. The local server must still own orders/stock; an external backend remains unsupported. |
| Criteria are browser-decidable | The claimed inherent single-context limitation is refuted by the installed tool. Actual `browser_run_code_unsafe` can create another browser context while retaining the first. Both independent baskets survived reload, cleanup preserved the original MCP page, and ordinary browser tools still worked afterward. The rubric now includes this tested recipe. |

There are **24 Functional criteria, total weight 35**, four Polish and six Visual criteria. The canonical 60/20/20 formula, functional floor, timeouts, scorer, runtime, golden solution and deep commercial criteria are unchanged. No extra requirement to display weights or shipping-band names was added.

## Verification

- Actual installed MCP, with the configured `--isolated` flags, proved simultaneous clean-context basket isolation and all five catalogue controls. An optional browser script fulfilled through a local reserved-domain route loaded successfully; this is a deterministic browser control, not an internet-connectivity claim.
- Source and extracted archive audits, contract checks, seed arithmetic and score-bound cases passed. Exact counts and scope are in `QC_FINAL.md` and the adjacent JSON reports.
- Fresh agent/verifier images use `20260926-followup`. Public inputs, an empty agent app and all 15 copied verifier files match the frozen source; Chromium is 152.0.7977.8.
- The shared network-policy guard passes both corrected tasks and the current template. It reproduces failures on both prior archives and blocks packaging before writing output: seven regression cases passed.
- Prior backend, gate, installer and deep checkout evidence is reused because the relevant application and harness bytes did not change. This follow-up does not claim those entire suites were rerun.

See `MCP_CONTEXT_AND_PRESENTATION_REVIEW.md`, `FUNCTIONAL_FIX_REVIEW.md`, `NETWORK_STANDARD_REVIEW.md`, `network-regression-results.json` and `QC_FINAL.md`.

## Score implications and limits

The catalogue splits alone expose at most 0.35 formerly bundled raw points: **+0.006 reward**, provided the same gates and floor pass. Removing the two unrequested display bars can restore another five raw points. Together their modeled maximum is **+0.0918 after rounding** when both versions clear the floor and presentation is held fixed. Across the floor, an abstract Boolean witness can move from zero to 0.5217. These are arithmetic bounds, not measured model behavior or claims that every abstract combination describes a realizable app.

The gate correction is separate: a fully working CDN-using app that previously received an unjustified zero may recover all its earned reward, potentially up to 1.0. Visual evidence ownership also changed, so the fixed-presentation bounds are not unconditional bounds on the whole revision. We cannot retain unfair penalties to force a lower model score.

No known reported source defect remains unresolved. Official platform QC, paid Oracle 1.0 and target-model scores remain unmeasured. A complete local checklist or a successful golden browser probe does not guarantee those outcomes. No upload, submission, commit or push was performed.
