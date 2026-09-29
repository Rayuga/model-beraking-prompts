# Ridgeline requirement-first coverage review

26 September 2026. This authoring evidence stays outside the task ZIP. The map starts with the actual public requirements, including their negative implications, and then identifies the shipped check. It does not infer coverage merely because the golden implements something or a local helper happened to test it.

## Frozen functional inventory

| Ref | Criterion ID | Weight |
| --- | --- | ---: |
| F01 | ridgeline_catalogue_cards_and_variant_details | 0.4 |
| F02 | ridgeline_catalogue_search_and_filter_membership | 0.3 |
| F03 | ridgeline_catalogue_price_and_title_ordering | 0.3 |
| F04 | variant_stock_and_valid_basket_boundary | 1 |
| F05 | ridgeline_unplaced_basket_survives_full_reload | 0.75 |
| F06 | ridgeline_zero_quantity_removal_stays_empty | 0.75 |
| F07 | trade_threshold_reversal_and_size_isolation | 1 |
| F08 | postage_inclusive_boundaries_and_collection | 1 |
| F09 | historical_receipt_uses_charged_prices | 1.25 |
| F10 | ridgeline_unknown_reference_does_not_substitute_receipt | 0.25 |
| F11 | mixed_trade_prices_survive_order_lookup | 2.5 |
| F12 | ridgeline_incomplete_delivery_address_refuses_atomically | 2 |
| F13 | authoritative_prices_on_fresh_checkout | 2 |
| F14 | combined_quantities_and_invalid_checkout_are_atomic | 3 |
| F15 | stale_multiline_checkout_leaves_every_stock_unchanged | 3 |
| F16 | checkout_retry_identity_and_new_purchase | 3 |
| F17 | cancellation_is_terminal_and_restores_stock_once | 3 |
| F18 | simultaneous_last_copy_commits_only_once | 2.5 |
| F19 | last_unit_order_and_fresh_oversell_refusal | 1.5 |
| F20 | successive_orders_use_remaining_stock_and_own_tiers | 2.5 |
| F21 | restart_preserves_receipts_stock_and_retry_terminality | 3 |

There are **21 binary functional criteria, total weight 35**. Nine criteria with adversarial requests or replay probes (F12–F19 and F21) total **23**, or about 65.7%. These are internal weights; final dimension shares remain 0.6 functional, 0.2 polish and 0.2 visual, with the existing 0.05 functional floor.

The first catalogue criterion is 0.4 and the read-only known/unknown-reference criterion is 0.25. Even conservatively crediting all catalogue checks and unknown lookup to a thin read-only shell gives 1.25/35 = 0.035714, below the floor. Separating them has not made a static receipt worth 1.25: F09 still requires a real current purchase. The constraints gate additionally requires a new order retrievable in an independent browser context.

## Public product requirements → observable checks

Sources: [brief](../../../projects/ridgeline-print-storefront/instruction.md), [catalogue note](../../../projects/ridgeline-print-storefront/environment/instructions/README.md), [checkout note](../../../projects/ridgeline-print-storefront/environment/instructions/checkout-note.md), and [integration note](../../../projects/ridgeline-print-storefront/environment/instructions/integration.md). These links are relative to the repository; the source paths below identify the requirement even when viewing this report outside its original directory.

| Requirement from the public request/notes | Positive observation in the shipped rubric | Negative/boundary observation, or why not applicable |
| --- | --- | --- |
| Public shop, no account or sign-in | Render gate opens populated shop and detail without authentication; functional global gate uses that public product | No authentication dependency is imposed on purchase or lookup. |
| Eight supplied prints and thirteen exact SKU/size variants | F01 checks the complete catalogue/details against a trusted thirteen-row table | Missing, repeated or invented variants fail the complete collection comparison. |
| Use each print's actual photograph; larger detail image | F01 observes each grid/detail pair and its associated print image | Placeholder/missing images or details no larger than cards fail; no invented aesthetic similarity threshold. |
| Supplied titles, papers, prices, stock and trade offers | F01 includes trusted exact metadata and current stock expectations for all thirteen variants | Includes zero-stock variants, so their omitted price/paper/quantity is not excused. |
| Each size has separate stock; only entirely sold-out prints are sold out on the grid | F01 shows Harbour Mouth available with A3 stock; F04 adds its A3 | F04 refuses Harbour A2 and Allotment; F01 confirms whole-print state. |
| Grid price is the lowest regular price across offered sizes, including sold-out ones | F01 checks the per-print grid prices and variant facts | F03 uses those same prices for ordered groups; no invented tie order. |
| Title search ignores case and clears | F02 searches mixed-case hArBoUr and restores all eight | Nonmatches must be absent while searching. |
| Paper-size and stock-sheet filters include offered sold-out variants | F02 checks exact A2 and Munken memberships, then clears | Includes Harbour's sold-out A2 and excludes all wrong-size/paper prints. |
| Price and title sorting, both directions | F03 explicitly exercises ascending/descending price and title over all eight | Wrong membership/order fails; equal-price ties remain unrestricted. |
| Trade threshold belongs to exact print and size | F07 reaches the A3 threshold while A2 stays regular | Below threshold and combined sizes do not qualify; F11 also prevents pooling different prints. |
| Every unit on a qualifying line gets the trade price | F07 and F14 check charged unit and whole-line totals at threshold | F07 reduces below the break and verifies the regular price returns. |
| Adding the same variant again combines quantity for trade and stock | F14 uses repeated UI additions and a qualifying combined checkout | Duplicate list entries, or equivalent combined quantity in unique-keyed requests, cannot bypass overstock enforcement. |
| Trade offer visible before qualification; applied saving afterward | F01/F07 show the offer and F07 shows applied amounts | F07 reversal removes the applied saving; no exact wording/layout required. |
| Separate full-price subtotal, saving, postage and total in basket/checkout | F07/F11 verify all four amounts and regular-price gross calculation | F11 verifies the complete visible summary before commitment; no separate review screen is mandated. |
| Changes to basket lines recalculate prices and summary | F07 adds/reduces around the break; F08 changes basket weight | F13 rejects or correctly reprices customer-forged monetary claims. |
| Postage sums all sheet weights, unaffected by trade discount | F08 mixed-size baskets use A3 90 g/A2 160 g, including trade-qualified quantities | Inclusive 500 g and 2,000 g boundaries checked before a 2,090 g basket. |
| Letter/Large letter/Small parcel rates and collection above final band | F08 checks 90 g, 500 g and 2,000 g amounts | Over 2,000 g is clearly collection-only with zero postage. |
| Basket persists in that visitor's browser after reload | F05 creates two Night Ferry A2 and performs a genuine full reload | Empty/different basket or an already placed receipt cannot pass. |
| Separate visitors have separate baskets | F05 starts an independent clean context, adds its own Long Field A3 and reloads both | No copying client storage; each visitor must retain only their own lines. |
| Zero quantity removes an unplaced line and stays removed | F06 first adds a real line, then sets zero and reloads | A permanently empty app cannot earn this without the observed addition. |
| Whole sheets; excessive basket quantity refused with actual availability and last good basket kept | F04 adds the one available Slack A2 normally | Increase to two is refused and the original one-unit line survives; F14 separately rejects non-whole checkout quantities. |
| Recipient, address line, city and postcode all required, including server enforcement | F12 places its own valid UI order and another fresh valid order after the negative probes | Four fresh requests each omit/blank one required component. No new order, stock mutation or existing-receipt change is allowed. No postcode-format requirement added. |
| Customer sees entered address and full amounts before committing | F11 checks pre-commit address/summary; accepts single-screen checkout | A receipt that reveals the address/total only after purchase cannot satisfy this. |
| No payment step or card form | F11 completes checkout and explicitly checks no payment/card form is part of it | No external payment success is used as a prerequisite. |
| Unique order reference usable later without the original browser's memory | Constraints gate writes a new order and retrieves it from a clean context; F16/F20 create distinct fresh purchases | A seeded/static receipt or client-storage-only success cannot satisfy that gate. |
| Unknown reference produces a not-found result, not another receipt | F10 looks up RP-100001 successfully before and after the unknown reference | Unknown lookup cannot substitute the last/another receipt; no exact HTTP status or text demanded. |
| Basket reserves no stock; checkout uses live stock and commits all lines or none | F15 prepares an earlier basket, then completes an intervening valid order | The stale multi-line checkout refuses with every affected stock and the intervening order unchanged. |
| Two simultaneous buyers cannot receive the same final copy | F18 first buys a normal unit successfully | Two concurrent fresh identities then have exactly one winner and stock zero. |
| Exactly the remaining quantity is purchasable | F19 buys the final Slack A2; F20 buys the final three Long Field A2 | F19 submits a fresh oversell attempt and proves refusal without modifying the successful receipt. |
| Checkout quantities positive and whole; identifiers real | F14's successful real orders establish the operation | Fresh zero, negative, fractional and mixed valid/unknown-line requests refuse atomically. |
| Server owns unit price, saving, postage and total | F13 first places the real GBP 67.70 order | Fresh forged monetary claims are safely rejected or stored at the authoritative amount; old completed identity cannot mask the probe. |
| Lost response/repeated submission of the same checkout is not another order | F16 creates a real successful attempt and replays its exact body twice | Original reference/receipt and unchanged stock required, not an ordinary stock error. |
| Same completed attempt cannot change lines, quantities or address | F16 records the original order | Changed quantity and changed valid address under its identity are refused without changing the original. |
| A new intentional checkout can buy the same basket again | F16 initiates a new checkout with the same basket/address | A different reference and one additional stock decrement are required. |
| Order stores original address, quantities, regular/charged prices, saving, postage and total | F11 reloads a mixed trade order; F20 rereads two differently priced orders | A later trade-qualifying purchase cannot retrospectively discount the earlier receipt. |
| Historical order keeps its original charged price and dispatched status | F09 compares seed RP-100001 with a real current-price purchase | Both are reread to ensure neither borrows the other's charged prices. |
| New placed orders can be cancelled from confirmation/lookup | F17 creates and cancels a real five-unit order through its UI | F17 checks visible cancelled status plus exactly five units restored. |
| Cancellation preserves receipt/address and restores each quantity once | F17 rereads the cancelled receipt and stock | Repeated cancellation requests cannot restore again. |
| Cancelled order never resurrects when its original checkout is retried | F17 preserves the original successful request | Its replay returns the same cancelled reference without stock deduction. |
| Dispatched order cannot be cancelled or return stock | F17's successful new-order cancellation establishes the real cancellation operation | Applying it to RP-100001 refuses and preserves that order and the observed stock. |
| Orders, cancellations, attempts and stock survive application restart without reseeding | F21 creates its own placed/cancelled controls, then invokes one real process restart | Original references/statuses/amounts/stocks remain, exact retries stay terminal, repeated cancel adds no stock, eight/thirteen identities remain unique. |
| Comfortable mobile layout | Polish responsive_layout and visual responsive_consistency inspect about 390 × 844 | Essential controls/text cannot be clipped or overlapped; no required mobile arrangement. |
| Keyboard usability and identifying control labels | Polish labelled_controls_and_focus uses real Tab navigation and named controls | Search plus two enabled controls must have visible focus. This is basic keyboard usability, not an unrequested complete keyboard-only purchase. |
| Light/dark modes and usable navigation | Polish theme_and_navigation toggles both and returns from detail/basket; visual contrast/consistency checks each offered theme | Cosmetic label changes without actual readable palette changes do not satisfy it. |
| Ordinary actions have visible feedback | Polish interaction_feedback searches/clears and adds an available unit | A control that silently does nothing cannot satisfy the required observed update. |

## Runtime and implementation requirements

| Requirement in integration.md | Actual coverage and honest limit |
| --- | --- |
| Finished app in /app; node /app/server.js; 0.0.0.0:3000; /app/public/index.html | Harness launches the prescribed server and browser gates require the reachable UI. Packaging/source checks can verify the files. HTTP success alone does not prove the precise static-file implementation. |
| Successful prompt GET /api/health | Constraints gate checks an actual successful response; harness separately measures startup reachability. No invented JSON schema. |
| SQLite /app/app.db and DB_PATH | Harness supplies DB_PATH and restarts the app over that location. F21 proves durable observable behavior, not the internal database engine. Local source/runtime review can check the reference's engine, but judges do not read submitted source. |
| React, Node.js, Express, SQLite | Supplied environment and golden source use the requested stack. Browser behavior cannot establish exact internal libraries. Explicit observability limitation, not a claimed browser PASS. |
| Initial seed once; no duplicate catalogue/order recreation | F21 compares live pre/post-restart stock, thirteen variant identities and its own tracked references/replays. It does not invent a public all-orders endpoint or enumerate hidden rows. |
| Copy required inputs into /app; delivery independent of original /assets | solve.sh and local isolated execution checks establish this for the golden. A browser alone cannot prove where an arbitrary submission reads its files. |
| Local required scripts/styles/images/data; no grade-time package install or external request | Constraints gate has a bounded normal-browser-load network observation (root-owned edit). Prior golden browser tests observed no external requests. It is not proof about every possible future state or every startup-side network action. |
| One Node process and no external backend service | Harness launches one stated process; independent-context lookup proves shared write/read. Exact internal topology and absence of concealed proxying cannot be established solely from browser responses. |
| Only preinstalled Express/better-sqlite3/Node server runtime dependencies | Agent/verifier image and local golden startup checks establish the supplied environment and reference compatibility. No source-level inference from functional reward. |

## Why the earlier review missed the address gap

The earlier ledger was labelled requirement-to-check but its rows began with existing criteria. That checked whether tests were justified; it did not exhaustively enumerate the public requirements. The external backend helper also successfully rejected a blank postcode, but that helper was not shipped as a scoring criterion. Passing the golden's extra local test did not cover the missing judge probe.

The repairs keep coherent historical/current-price comparison and stock/retry flows intact, while separating broad discovery, ordering, basket-removal and not-found outcomes. The workbook/skill permit linked multi-leg flows, so splitting every assertion into an independent score is neither necessary nor desirable. F05 visitor persistence and F12 valid/invalid/valid addresses each remain one related behavior.

## Stock allocation after the constraints gate

The gate places exactly one Kiln A3: 7 → 6. F11's mixed order takes one: 6 → 5. F12 valid control takes one: 5 → 4; all four refused address probes leave four; its new valid follow-up takes one: 4 → 3. F21 observes S (normally three), creates/cancels one back to S, and places another to finish at S−1 (normally two). Other variant allocations are unchanged from the earlier sixteen-criterion version.

Every affected criterion uses observed before/after stock. F12 stops further writes on an unexpected accepted invalid address rather than draining the fixture and automatically breaking later work. F21 establishes its own controls and never inherits the earlier criterion's verdict. Normal constraints-gate failure skips scored dimensions; a successful gate is the only assumption behind its one-unit allocation.

No paid judge score, Oracle 1.0, target-model result or platform QC acceptance is asserted by this document. Root and the independent agents own the subsequent browser witnesses, final QC and archive verification for the settled candidate.
