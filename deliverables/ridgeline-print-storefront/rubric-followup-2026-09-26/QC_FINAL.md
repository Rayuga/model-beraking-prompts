# Ridgeline follow-up: independent final QC

The local review answers all **53 quality checks: 46 Pass, 7 Note, 0 Fail**. All **48 deterministic inventory entries** have a disposition: 34 PASS, 10 NOTE, 4 N-A. These are local executable checks and manual equivalents, not results from the platform's unavailable private checker implementations. No remaining source blocker was identified. Paid Oracle/provider execution and actual target-model scores remain unmeasured.

The final [archive](ridgeline-print-storefront.zip) has **51 files, 699,956 bytes**, SHA-256:

`7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6`

Independent verification checks CRC, one root directory, unique safe paths, executable shell modes, and equality of every archived byte with the final source and [manifest](candidate_manifest.json). Nine files changed from `f8a9b605…`; the full golden app and installer, seed/images, Dockerfiles, launcher, canonical tools, scoring policy and four Polish criteria are unchanged. Functional now has 24 criteria totaling 35; there are 36 criteria across the five dimensions.

## The reported findings

The former rubric imposed two receipt-display details the public request did not require: postage-band names and grams. Those mandatory labels are removed. Correct monetary fields, inclusive postage calculations, collection-only behavior and persistent receipt amounts remain required. Adding extra labels to the brief just to justify our old test would have changed the product unnecessarily.

Search, size filtering and paper filtering now have separate 0.1-weight outcomes; price and alphabetical sorting have separate 0.15-weight outcomes. These preserve the original two groups' total 0.6 weight while allowing each control to fail independently. Each starts from its own unfiltered catalogue and compares all matching records or the full order.

The former responsive Visual anchors repeated mobile clipping and inaccessible controls already covered by Polish. Polish retains mobile usability. The sixth Visual criterion now compares proportions, grouping and density across widths and explicitly excludes those mobile usability observations. The first five Visual criteria use desktop views. Simple conventional presentation can still earn full credit.

The app-wide external-asset ban was a genuine standards conflict. Integration and Constraints now explicitly allow external fonts, scripts, images and CDN assets; the supplied local backend remains required. [NETWORK_STANDARD_REVIEW.md](NETWORK_STANDARD_REVIEW.md) preserves exact authority and prior offending lines. Our earlier acceptance of self-authored offline wording as an exception was unjustified and is superseded.

The reported claim that isolated Playwright MCP inherently prevents independent simultaneous contexts is **refuted by an actual installed-tool call**. `browser_run_code_unsafe` creates a second clean context while preserving the original page. The rubric now supplies that browser-only recipe and cleanup steps. The visitor-isolation requirement remains intact.

## New executed evidence

| Evidence | Result and scope |
| --- | --- |
| [Source audit](qc_source_evidence.json) | 83 local assertions pass against the final source. |
| [Independent extracted audit](qc_independent_extracted_source_evidence.json) | Same 83 assertions pass against the extracted final archive; all hashes match the manifest. |
| [Contract audit](contract-checks.json) | 22 checks pass: exact 24/35 inventory, split weights, expected full control memberships/order, monetary figures and tool-recipe requirements. |
| [Actual MCP context proof](two-context-mcp-results.json) | Real JSON-RPC `tools/list` and `tools/call` against the pinned MCP server, with `--isolated` and Chromium 152.0.7977.8. Context B starts with empty cookies/origins; A and B retain distinct baskets after reload; both are cleared; no purchase or stock change; original MCP page and ordinary snapshot remain usable. |
| [Five catalogue controls](catalogue-controls-mcp-results.json) | All five outcomes pass through the actual installed MCP tool. Complete search/size/paper sets and both sort directions match the seed. |
| [Optional asset control](catalogue-controls-observations.json) | A unique external-style script URL is locally fulfilled first in an unprotected page and then in the app; both load and search still works. This is browser capability evidence, not a test of real internet connectivity. |
| [Network regression](network-regression-results.json) | The guard rejects the preserved old policies and accepts both corrected tasks; packaging checks the rule on source and extraction. |
| [Final images](final_image_evidence.json) | Both images build; public inputs and all 15 verifier files match frozen source. Agent `/app` is empty apart from Git scaffolding and contains no private solution/tests. |
| [Score analysis](score-bound-results.json) | Enumerated outcome bounds and actual canonical scorer witnesses are recorded; limits are stated below. |
| [Independent binding](independent_review_evidence.json) | Exact archive/source/evidence hashes and all 53/48 workbook inventories verified. |

The [MCP review](MCP_CONTEXT_AND_PRESENTATION_REVIEW.md) records complete observations, scripts, tool version and screenshots. Its fresh disposable application container was removed after capture; it did not reuse or mutate another agent's database. The golden was not modified to satisfy these clarifications.

Earlier evidence is preserved and reused only for unchanged behavior: 203 backend assertions, deep checkout/retry/cancellation browser cases, independent shared-order golden/mock witnesses, seven installer cases, actual restart-MCP proof and presentation screenshots. They are not relabelled as new runs. The entire revised 24-criterion rubric has not been rerun through a paid judge.

## Coverage and reward limits

[REQUIREMENT_COVERAGE.md](REQUIREMENT_COVERAGE.md) begins with public requirements and maps them to the current inventory; [FUNCTIONAL_FIX_REVIEW.md](FUNCTIONAL_FIX_REVIEW.md) and [criterion-crosswalk.json](criterion-crosswalk.json) explain the exact splits and display corrections. Browser evidence still cannot identify an exact database engine or framework, so a successful server-backed order is not represented as proof of SQLite or Express internals.

The 60% Functional / 20% Polish / 20% Visual policy, strict Functional >0.05 floor and zero-weight gates are unchanged. The catalogue split alone can increase unrounded reward by at most 0.006 when both versions clear the floor and other outcomes stay fixed. Including restoration of credit previously lost to the unrequired receipt labels, the modeled maximum **published** increase is **0.0918**, assuming both gates pass and presentation scores are equal. An abstract Boolean floor-crossing witness goes from zero to **0.5217**. These are arithmetic bounds, not claims that every outcome combination describes a feasible app or predictions of model difficulty.

The CDN gate correction is a separate effect: a fully working app formerly assigned zero just for permitted assets can now receive its full otherwise-earned reward, up to an abstract **0 → 1.0**. The conditional redistribution bound must not be quoted as an unconditional bound on the complete repair. That score restoration fixes a false failure rather than relaxing the storefront's business rules.

The seven Notes preserve limits on paid golden coverage, generated-state repeatability, provider execution, browser-only architecture proof, bounded mock rejection, empirical ranking and remote-judge determinism. Source checks and a successful workbook build cannot guarantee official QC, Oracle 1.0 or a target-model score.

The [client-safe workbook](QC_FINAL.xlsx) and [complete findings](qc_final_findings.json) contain every check. [Workbook validation](workbook_validation.json) reopens the result, verifies exact inventories/counts and confirms internal sheets are removed. Prior reports and archives remain unchanged; their disproven network/display/overlap reasoning is superseded by this report.
