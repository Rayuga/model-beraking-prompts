# Ridgeline hardening fairness ledger

Date: 2026-09-26. Profile: staged gates + scored dimensions. This is a local authoring artifact, excluded from the task ZIP.

The downloaded shop is the baseline, not evidence of a successful Oracle or target-model measurement. Current functional rubric: 16 binary criteria, total internal weight 35. Dimension shares remain functional 0.6, polish 0.2 and visual 0.2. Eight criteria with actual adversarial or replay probes carry weight 21 (60%). The prior functional rubric had weight 24 and two direct server probes totaling 2 (8.33%). This is a description of probe coverage, not a measured model score.

## Requirement-to-check map

| Functional criterion | Explicit brief or notes anchor | Why the check is fair |
| --- | --- | --- |
| catalogue_discovery_and_real_prints | instruction.md catalogue paragraph; README catalogue, matching and sorting paragraphs | Title search, both filters, title and price sorting, available variants, real images and card stock are requested; ties are not prescribed. |
| variant_stock_and_valid_basket_boundary | README per-variant stock; checkout-note.md basket paragraph | Valid addition precedes the excess-quantity refusal. Disabled UI plus an available count is acceptable for this UI-only boundary. No checkout occurs. |
| unplaced_basket_reload_and_zero_removal | checkout-note.md browser basket and zero-removal paragraphs | Uses a real reload and exact unplaced values, then removes the line with zero. |
| trade_threshold_reversal_and_size_isolation | README Trade prices | Exact-variant threshold, reversal below threshold and same-print different-size isolation are all explicit. No purchase consumes later fixtures. |
| postage_inclusive_boundaries_and_collection | README Postage; seed postage_bands and size_weights | Tests 90 g, exactly 500 g, exactly 2,000 g and 2,090 g. Collection is required above the last band. |
| historical_receipt_uses_charged_prices | checkout-note.md Stored orders; seed orders | A current real purchase and the seeded historical receipt prove different saved charged prices. A static seed page alone cannot pass. |
| mixed_trade_prices_survive_order_lookup | README Trade prices; checkout-note.md subtotal and Stored orders | Distinct prints sharing the same break cannot pool; the one eligible line gets its trade price in the durable order. A single-screen checkout is allowed. |
| authoritative_prices_on_fresh_checkout | checkout-note.md Buying the last copies, monetary claims | A genuine successful control precedes a fresh-identity monetary forgery. Safe rejection and safe authoritative repricing both pass; neither exact response status nor payload field name is prescribed. |
| combined_quantities_and_invalid_checkout_are_atomic | checkout-note.md positive whole quantities, repeated entries and invalid whole orders | Normal one-unit order proves operation validity; repeated UI adds and a combined five-unit order establish the trade case before overstock/malformed attempts. Lists can represent duplicates; unique-keyed maps use an equivalent combined quantity, and still must reject overstock. |
| stale_multiline_checkout_leaves_every_stock_unchanged | checkout-note.md Buying the last copies | Two browser baskets model a real lost stock opportunity. Both affected stock values and the competing valid order are read again; a status error alone cannot pass. |
| checkout_retry_identity_and_new_purchase | checkout-note.md Retrying checkout | Exact retries, changed content with the same identity, and a separate same-basket purchase distinguish three explicitly requested cases. |
| cancellation_is_terminal_and_restores_stock_once | checkout-note.md Stored orders and cancellations | A real placed order is cancelled first; repeated cancellation, original checkout replay and dispatched-order refusal cannot gain stock or recreate the order. |
| simultaneous_last_copy_commits_only_once | checkout-note.md Buying the last copies | A prior normal buy establishes the real endpoint. Concurrent different identities model two buyers; exact retries are a different criterion. |
| last_unit_order_and_fresh_oversell_refusal | checkout-note.md exact remaining quantities and atomic placement | The last unit is bought successfully before the fresh-attempt oversell is refused. |
| successive_orders_use_remaining_stock_and_own_tiers | README Trade prices; checkout-note.md stock commit and stored receipts | First two units remain full price; the next three meet their own tier and consume exactly the remainder. The first receipt is reread. |
| restart_preserves_receipts_stock_and_retry_terminality | integration.md SQLite durability and seeding; checkout-note.md retry and cancellation durability | Creates its own placed and cancelled controls before one actual restart, so an earlier criterion's failure is not automatically a persistence failure. |

## Shared-state allocation

The first five criteria only inspect the catalogue or change browser baskets. Every such basket is cleared.

| Mutating chain | Variants | Expected ending stock when all preceding checks pass |
| --- | --- | --- |
| Historical/new-price comparison | Long Field A3 | 12 -> 11 |
| Mixed trade order | Long Field A3, Kiln A3, Two Weathers A3 | 11 -> 9; 7 -> 6; 14 -> 9 |
| Fresh monetary tamper | Two Weathers A2 | 3 -> 2 after control; remains 2 on safe rejection or becomes 1 on safe repricing |
| Combined and invalid quantities | Nine Windows A3 | 20 -> 19 -> 14; every refused attempt leaves 14 |
| Atomic stale cart | Harbour Mouth A3; Long Field A3 as valid companion | Harbour 9 -> 1; Long Field observed baseline remains unchanged |
| Checkout retries | Night Ferry A2 | 4 -> 3, retries unchanged, fresh purchase -> 2 |
| Cancellation | Night Ferry A3 | 6 -> 1 -> 6; every repeat stays 6 |
| Concurrent last copy | Slack Water A3 | 2 -> 1 -> 0; exactly one of two independent concurrent attempts wins |
| Exact last unit | Slack Water A2 | 1 -> 0; fresh oversell refused |
| Successive trade orders | Long Field A2 | 5 -> 3 -> 0 |
| Persistence's own controls | Kiln A3 | Observe S; first buy/cancel restores S; second buy leaves S-1 (normally 5); restart and replays leave S-1 |

The functional prompt requires fresh checkout identities for every independent pricing, quantity and stock probe. Otherwise an old idempotent result could make an invalid request appear safely handled without exercising its new values. Each completed identity is preserved only in explicit retry tests.

When an earlier failed check omitted a shared-stock write, a later independent check reads current stock and verifies its own actual delta. That does not waive any current required operation, arithmetic or refusal. Dedicated untouched lines still use their seed quantities.

## Removed unfair assumptions

- No required extra review page; the customer needs the full address/summary before committing.
- No required HTTP 4xx for a safe refusal.
- No demand that a forged cheap price be accepted; rejection without mutation is valid.
- No invented authentication, cross-tenant or CSRF requirements for this public shop.
- No fixed endpoint paths, checkout-id field names or JSON line-field names.
- No duplicate-key test on a representation that cannot safely express duplicate keys.
- No passing a negative probe solely because a button is absent.
- No positive control after the negative claim.
- No dependence on a prior failed criterion's missing reference for the final persistence check.

## Floor and practical limits

Only the discovery criterion (weight 1/35 = 0.02857) can pass without a basket mutation or real order operation. The historical-price criterion now requires a real new purchase. Purely static populated pages therefore cannot clear the functional floor of 0.05 through these two read surfaces. A genuinely working client-side basket is substantive behavior and may earn its own criteria; the rubric does not manufacture a failure merely to force a score.

These source checks and arithmetic checks do not establish a paid Oracle score, browser-judge reliability, visual score or target-model score. The local golden walk, runtime checks and full QC workbook are separate evidence. Paid measurements must be reported separately when authorized.