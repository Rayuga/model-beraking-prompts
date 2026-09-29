# Ridgeline functional rubric follow-up

The frozen functional source has **24 binary criteria, total weight 35**. This revision repairs the current uploaded rubric's unwritten postage-display requirements and separately scores independent catalogue controls. It also gives the basket isolation check a recipe proven through the installed MCP tool. The catalogue arithmetic, stock allocation, address validation, retries, cancellation, concurrency and restart behavior remain in place.

`functional-before.toml` preserves the earlier 21-criterion source. `functional-source.diff` is its exact comparison with the revised source. `criterion-crosswalk.json` lists all ID/weight changes. `contract-checks.json` binds the review to the functional SHA256.

## Before and after

| Earlier criterion | Earlier requirement | Revised requirement |
| --- | --- | --- |
| mixed_trade_prices_survive_order_lookup, 2.5 | Checkout shows “Small parcel postage GBP 4.95 for 720 g” as part of the required visible figures. | Checkout shows gross subtotal GBP 326.35, saving GBP 31.25, postage GBP 4.95 and total GBP 300.05, together with the address. No visible band or grams required. |
| successive_orders_use_remaining_stock_and_own_tiers, 2.5 | Second receipt shows “postage GBP 3.20 for 480 g”. | Second receipt shows GBP 3.20 postage and the same correct charged figures; no visible weight required. |
| postage_inclusive_boundaries_and_collection, 1 | Derived grams appeared alongside expected charge, allowing a reviewer to misread them as UI requirements. | Explicitly says those weights are calculation inputs. The app need only display the charge and collection-only status when applicable. All inclusive boundary cases remain. |
| ridgeline_catalogue_search_and_filter_membership, 0.3 | Search, size filter and paper filter earned one all-or-nothing score. | Three independent criteria at 0.1 each: title search, size filtering and paper filtering. Each owns its initial full catalogue and clearing check. |
| ridgeline_catalogue_price_and_title_ordering, 0.3 | Price order and alphabetical order earned one all-or-nothing score. | Two independent criteria at 0.15 each. Each checks both directions of its own ordering, without depending on the other. |
| ridgeline_unplaced_basket_survives_full_reload, 0.75 | Required independent visitors but left the browser-tool mechanics implicit. | Same outcomes and weight, with an exact two-context MCP recipe, empty initial storage, both visitors kept alive, cleanup and no purchases. |

The public notes request a postage calculation based on weight, and a visible subtotal/saving/postage/total. They do not ask the customer to see the calculated weight or the internal band name. Requiring those extra displays was therefore a genuine false-negative risk. It is corrected in the verifier rather than adding extra product requirements merely to justify an old test.

The two catalogue groups also contained distinct user controls. Separating them permits fair partial credit when, for example, search works but the size filter does not. A control and its reverse/clearing action remain together because that establishes the same behavior. Deep business chains retain linked positive control, refusal, fresh state observation and recovery; those steps prevent false positives from an entirely broken endpoint.

Earlier local review missed the display issue by treating the supplied arithmetic as if every derived fact was requested on screen. Golden success could not expose that mistake because the golden already displays more information. The prior coarse grouping was accepted because the controls were cheap and related, which did not answer whether their behavior was independently useful. The source diff now shows the actual scope change instead of relying on a passing golden as proof of fairness.

## Seed arithmetic remains exact

The follow-up contract checker independently computes these values from `environment/assets/seed_data.json`, without importing the golden's calculation code:

| Basket | Derived weight | Gross | Saving | Postage | Payable |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 Long Field A3 + 1 Kiln A3 + 5 Two Weathers A3 | 720 g | £326.35 | £31.25 | £4.95 | £300.05 |
| First order: 2 Long Field A2 | 320 g | £113.00 | £0.00 | £3.20 | £116.20 |
| Second order: 3 Long Field A2 | 480 g | £169.50 | £17.25 | £3.20 | £155.45 |

Separate preview cases still verify 90 g → £1.75, exactly 500 g → £3.20, exactly 2,000 g → £4.95, and 2,090 g → collection only with zero postage. These are expected computations, not new labels the customer must see.

The new catalogue checks are also derived from the seed: eight titles; the five A2-bearing prints include Harbour Mouth despite its A2 being sold out; Munken paper yields Harbour Mouth, Slack Water and Two Weathers; five prints start at £37.95 and three at £42.50. Alphabetical order remains Allotment, Harbour Mouth, Kiln, Long Field, Night Ferry, Nine Windows, Slack Water, Two Weathers.

## Two independent visitors are feasible with the shipped tool

`two-context-mcp-results.json` records the **actual installed** `browser_run_code_unsafe` tool, Playwright MCP 1.63.0-alpha-2026-08-05 and Chromium 152.0.7977.8, using the judge's configured headless/isolated/executable flags. This is stronger evidence than assuming that a standalone Playwright script implies tool availability.

The callback receives visitor A as `page`. `page.context().browser().newContext()` creates B without copying storage; B's initial cookies/origins are empty. Both contexts remain open while B adds its own basket and A is revisited/reloaded. A retains only two Night Ferry A2 at £132.20; B retains only one Long Field A3 at £39.70. Both baskets are cleared, no orders are submitted and all 13 stock quantities remain unchanged. Only B closes in cleanup; A remains usable and an ordinary subsequent MCP snapshot succeeds.

The verifier's recipe deliberately leaves app selectors and storage design unspecified. A second tab sharing A's context, copied local storage or clearing A to simulate B cannot establish visitor isolation. The instruction neither requires shell access nor asks the judge to install a browser package.

## Score effect: measured arithmetic, not a model forecast

The split alone has maximum additional raw credit 0.2 + 0.15 = **0.35**, so its conditional reward increase is **0.6 × 0.35 / 35 = 0.006**. The case enumeration covers all 32 combinations of the five independent controls.

Removing the two unintended display requirements can restore another **5 raw points** only for a submission that already satisfies both complete business checks but was failed solely for omitting the unrequested grams/band text. Together with the splits, the maximum gain is 5.35 raw, or **0.091714… unrounded reward** when the gates and Functional floor already pass. The shipped `tests/tools/score.py` was executed on synthetic inputs to confirm that final rounding can make the largest published difference **0.0918**.

The floor is a separate discontinuity. Exhaustive abstract credit enumeration also finds an old Functional raw total of 1.75/35, which fails the strict >0.05 floor, and a revised total of 7.1/35. With full presentation credit, the actual score tool yields **0 → 0.5217** for that synthetic case. This is not a measured candidate result and does not establish that any particular model has those behaviors. It prevents incorrectly presenting the conditional 0.0918 bound as universal.

`score_bound_check.py` enumerates 66,240 abstract states while holding unaffected outcomes fixed. Its assumptions and witnesses are in `score-bound-results.json`, with the actual score-tool inputs/outputs under `synthetic-score-cases/`. Postage wording and the context recipe clarify existing intended behavior rather than intentionally changing its scoring bar. No paid calls were made.

## Verification and limits

- `check_contract.py`: **22/22 passed**. Confirms 24 unique binary criteria, exact total 35, allowed ID changes, all 15 unaffected criterion objects identical, unchanged judge/MCP/budget configuration, independent seed calculations, recipe presence and public hygiene.
- `source_audit.py`: **83/83 passed** on current source and the final archive extraction. This preserves the prior 80 source assertions, adding the exact 24/35 count, grading-vocabulary guard and public browser-asset network policy. It supports `--task-path` for the extracted source.
- Public scans: **36 criterion IDs across four public documents**, no ID collision or internal grading vocabulary.
- `two-context-mcp-results.json`: actual browser-tool proof passed; screenshots and structured observations are preserved beside it.
- No backend or golden application code was changed for these functional corrections. The earlier successful deep business evidence remains relevant because its criterion objects and application implementation were not altered. It is not relabelled as a new paid Oracle run.

The parent audit separately handles the screenshot's polish/visual overlap, metadata counts, current public-network profile and final packaging. This report covers the functional revision only. Official platform QC and candidate/Oracle scores remain unmeasured for this new archive. Old 21-criterion reports are historical evidence and must not be used as if they describe this 24-criterion source.
