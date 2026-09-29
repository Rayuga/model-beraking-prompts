# Ridgeline golden and difficulty assessment

Fresh local verification on 28 September 2026 used separate disposable Docker instances. The user's localhost preview was not mutated. No task source was edited and no provider call or upload was made.

## Golden solution

- 13 commerce scenario groups passed: all catalogue variants; valid/sold-out/excess basket quantities and zero removal; trade reversal and inclusive postage bands; historical/unknown receipt lookup; mixed variant prices; forged-price refusal or authoritative repricing; duplicate/invalid lines; stale multi-line atomicity; identical and changed checkout attempts; cancellation and dispatched protection; simultaneous last-copy purchases; exact final-unit purchase and later oversell refusal; successive orders with different trade tiers.
- Nine browser groups passed: fresh server purchase and clean-context retrieval; search/filter/sort; keyboard navigation; labels, focus and control reachability; independent baskets/reload; incomplete-address refusal and valid recovery; collection checkout and concurrent cancellation; dropped-response recovery after cancellation elsewhere; stock-aware desktop/mobile presentation in both themes.
- Current template-identical test.sh launched the real app and performed an actual single-use MCP process restart. The fixture checked saved receipt, all thirteen stock values, historical receipt and retry identity. Its judge scores were synthetic, not Oracle scores.
- Both browser runs reported no page errors. All 19 solution files still match the previously mapped golden evidence.

These results support the core requested features. They do not establish that every current rubric row will receive a pass from the configured judge, that every possible edge case is correct, or that hosted Oracle will score 1.0.

## Difficulty

The task's real difficulty is the interaction of server-side stock transactions, variant-specific trade tiers, fresh versus repeated checkout identities, immutable charged receipts, terminal cancellation and process-restart persistence. A normal attractive shop implementation alone cannot earn these observations.

There is no measured Luna attempt for this candidate in the inspected run-outputs. The task is a plausible challenge, but a claim that it will keep Luna below 0.7 is unsupported. A strong implementation using SQLite transactions and well-designed checkout identities could score higher.

With both gates passing and perfect Polish/Visual, reward = 0.4 + 0.6 * Functional:

| Functional | Total |
| ---: | ---: |
| 0.30 | 0.58 |
| 0.50 | 0.70 |
| 0.70 | 0.82 |

Consequently, fewer than half the functional points must be earned to get below 0.7 when presentation is perfect. Separating independent outcomes can appropriately raise partial credit. These figures are conditional arithmetic, not predicted model scores. Further arbitrary strictness would risk repeating the Colderwater problem; obtain a measured builder/judge run after resolving template compliance instead.

## Release status

Not upload-ready. The custom prompts and gate/polish/visual criteria still differ from files without CHANGE_ME placeholders in the local template. Earlier source-audit results predate the complete test.sh restoration. Current configured-judge completion time, Oracle score, Luna score and hosted QC acceptance remain unmeasured. The old final ZIP is stale.

Evidence: assessment.json; commerce-run/commerce/results.json; browser-run/boundary-observations.json; harness/restart.log; harness/results.json.
