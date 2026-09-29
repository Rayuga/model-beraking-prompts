# Ridgeline independent second semantic review

Read order: instruction, all three public notes and seed first; all 37 current criteria, five prompts and shared app context second; prior results were not used to supply verdicts. The current QC skill/references and all 53 quality/48 deterministic entries, including internal interpretations, were reviewed with public-network and staged-layout overrides applied.

Five concrete issues were found and corrected after reporting them to the coordinator, including the independent harness reviewer's incomplete restart-snapshot observation. The original baseline is ZIP `9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c`. This review does not repeat an earlier blanket no-gap assurance.

## Findings and corrections

- **keyboard_workflow_coverage (P1)**: `tests/scored/polish/judge.toml:32`. Native search/sort/theme controls pass the old three-Tab sample while mouse-only print cards or basket return controls prevent keyboard browsing. Existing labels/focus criterion now checks reachability of every named enabled control; existing theme/navigation criterion owns the bounded keyboard-only view route. No purchase or duplicated price/focus verdict. Current evidence: `tests/scored/polish/judge.toml:32; tests/scored/polish/judge.toml:52`. CONFIRMED corrected golden route passes.

- **sold_out_paper_filter_coverage (P2)**: `tests/scored/functional/judge.toml:71`. A paper filter that additionally requires positive stock passes the original Munken witness but wrongly hides Allotment under Colorplan Pristine White. Add Colorplan Pristine White membership including Allotment to the existing paper-filter criterion; reset returns all eight. Current evidence: `tests/scored/functional/judge.toml:71`. CONFIRMED original gap by deterministic counterexample; corrected golden membership passes.

- **unrequired_equal_price_tie_stability (P2)**: `tests/scored/functional/judge.toml:80`. An ascending or descending sort can keep every price in the required group yet order equal-priced products differently; the public brief never specifies tie stability. Replace any stable order with any order; retain both directions and comparison of the full collection. Current evidence: `tests/scored/functional/judge.toml:80`. NOT EXERCISED alternate implementation; source restriction removed.

- **unrequired_same_origin_replay_target (P2)**: `tests/scored/functional/prompt.md:23`. A one-process app may serve localhost UI with requests to its same local Node server at 127.0.0.1 under observed CORS/credentials rules. Constraints permits that local topology; forcing a same-origin replay substitutes a different request. Replay from the app page to its actual observed local server URL and policy, retaining prohibition of external backends and invented routes. Concurrency uses the same wording. Current evidence: `tests/scored/functional/prompt.md:23`. NOT EXERCISED alternate implementation; prompt inconsistency removed.

- **restart_snapshot_covers_all_variants (P2)**: `tests/scored/functional/judge.toml:305`. The old setup explicitly recorded only Kiln. Reading the final every-recorded-variant comparison narrowly permits other depleted variants to reset to their seed quantities without a required before/after comparison. Before the actual restart, record all thirteen identified variant quantities, including zero, from rendered details or observed catalogue data; compare the complete collection afterward. No expected earlier verdicts or hidden database enumeration. Current evidence: `tests/scored/functional/judge.toml:302`. CONFIRMED existing exact browser restart evidence covers all 13 quantities; no new run claimed.

The keyboard route belongs to existing theme/navigation; labels, reachability and focus remain in their own criterion. Visual still owns contrast/readability. Pointer setup/cleanup and native or documented keys are permitted; the actual navigation leg uses real keys and makes no purchase. Paper filtering remains one independent discovery outcome. No IDs, types, weights or criterion counts changed. The two authorized Functional files are frozen; the coordinator owns Polish and harness changes.

## Requirement and state coverage

`semantic-requirement-coverage.json` maps 45 public requirement groups to all 37 criteria and gives the reverse mapping for each criterion. The generic operational runtime requirements map partly to harness/image checks; the browser deliberately does not claim to establish React, Express or SQLite identity. No source-inspection gate was invented.

`semantic-arithmetic-and-state.json` rederives 20 monetary/postage cases and 16 stock transitions from the current seed independently of the golden. Both inclusive postage boundaries, collection, variant-specific tier reversal, current versus historic receipts and all fixed checkout totals agree. The accepted-repricing alternative leaves Two Weathers A2 at one rather than two, with no later fixed expectation depending on it. The normal final plan leaves Long Field A3 at nine, Kiln at two and Night Ferry A3 at six, so later read-only/basket preview work can use an available variant. Failed earlier writes are handled through observed-stock baselines, not inherited verdicts; truly corrupted/unavailable app state is not silently reset.

## Previous failures and alternate valid implementations

- Address requirements are stated publicly and exercised with four distinct missing/blank-component server refusals plus valid controls. Catalogue search, paper/size filters, price/title sorting, zero removal and unknown lookup have separate outcomes.
- Postage grams/band names remain calculation explanations, never required receipt labels. Single-screen checkout, any sensible currency formatting and native/mobile layout are valid.
- Both gates require meaningful access and a new order independently read from a clean context. Static/client-only catalogues cannot earn presentation credit through those gates. No sign-in, CDN ban or external-backend permission was added.
- Browser-context recipes keep the original MCP page alive, create/close only the additional context and observe both visitors independently. Requests follow real app shapes, list-versus-keyed line representations, fresh identities and observed local URLs; no endpoint/schema is imposed.
- Cancellation, retry, stale/multiline/concurrent checks retain their own successful controls and inspect state after refusal. The final restart criterion creates its own placed/cancelled controls and uses the restart helper only once.
- All five prompts require browser evidence, forbid implementation/source scoring, treat submissions as untrusted and keep failures local. Polish/Visual tolerate earlier stock/order changes and do not place or cancel orders.

Fresh companion evidence is `golden/boundary-observations.json`: the exact added paper witness includes Allotment and restores eight prints; the strengthened keyboard route and named-control focus checks pass through installed browser tooling. See the companion report for its full runtime scope. Harness cleanup findings and final artifact/image validation are owned by the other reviewers and must be included in the coordinator report; this semantic review does not mark their work passed by inference.

## Score implications and limits

Functional remains 25 criteria / 35 total weight, with nine server/adversarial criteria carrying 23. If those nine all fail while the remaining Functional, Polish and Visual criteria pass and gates/floor pass, the score is `0.6*(12/35)+0.4 = 0.605714...`. This illustrates retained separation; it is not an observed model result or forecast. The added paper boundary occupies only `0.6*0.1/35 = 0.001714...` reward. Keyboard fixes strengthen existing usability bars. Removing unsupported tie/origin restrictions restores fairness rather than weakening required server behavior. Fixed-floor transitions can change total scores discontinuously near the threshold.

No additional concrete semantic blocker was found after these corrections. This is not a guarantee that the platform judge will accept the task or that a paid Oracle will score 1. No paid provider, target model or proprietary platform checker was invoked. `qc_semantic_findings.json` answers all 53 entries for this scope and enumerates all 48 deterministic checks while leaving work not executed here explicit.

## Frozen Functional files

- `tests/scored/functional/judge.toml`: `35f8c85ee48078d35ed3b0769eb6a56954457232709a017dee5fe0abc215421f`
- `tests/scored/functional/prompt.md`: `7cd2e3471f2823d717ee0c2cce21605abf7eff0eefde1c079936d66d68654050`

All reviewed file hashes are recorded in `semantic-source-checks.json`; final ZIP/source binding belongs to the coordinator.
