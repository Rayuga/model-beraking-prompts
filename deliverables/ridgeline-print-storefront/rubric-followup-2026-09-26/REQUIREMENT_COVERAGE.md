# Ridgeline requirement-first coverage: current follow-up

26 September 2026. This ledger describes the final **24-criterion, weight-35** functional rubric, not the earlier 21-criterion upload. The old ledger is preserved in `../rubric-fix-2026-09-26/`. This evidence remains outside the task archive.

The map begins with the current public brief and its three notes, then identifies observed checks. Passing the golden does not establish that every test is requested, and a requirement appearing somewhere in prose does not establish that it is actually observed.

## Current functional inventory

| Ref | Criterion ID | Weight |
| --- | --- | ---: |
| F01 | ridgeline_catalogue_cards_and_variant_details | 0.4 |
| F02 | ridgeline_catalogue_title_search | 0.1 |
| F03 | ridgeline_catalogue_size_filter | 0.1 |
| F04 | ridgeline_catalogue_paper_filter | 0.1 |
| F05 | ridgeline_catalogue_regular_price_ordering | 0.15 |
| F06 | ridgeline_catalogue_alphabetical_title_ordering | 0.15 |
| F07 | variant_stock_and_valid_basket_boundary | 1 |
| F08 | ridgeline_unplaced_basket_survives_full_reload | 0.75 |
| F09 | ridgeline_zero_quantity_removal_stays_empty | 0.75 |
| F10 | trade_threshold_reversal_and_size_isolation | 1 |
| F11 | postage_inclusive_boundaries_and_collection | 1 |
| F12 | historical_receipt_uses_charged_prices | 1.25 |
| F13 | ridgeline_unknown_reference_does_not_substitute_receipt | 0.25 |
| F14 | mixed_trade_prices_survive_order_lookup | 2.5 |
| F15 | ridgeline_incomplete_delivery_address_refuses_atomically | 2 |
| F16 | authoritative_prices_on_fresh_checkout | 2 |
| F17 | combined_quantities_and_invalid_checkout_are_atomic | 3 |
| F18 | stale_multiline_checkout_leaves_every_stock_unchanged | 3 |
| F19 | checkout_retry_identity_and_new_purchase | 3 |
| F20 | cancellation_is_terminal_and_restores_stock_once | 3 |
| F21 | simultaneous_last_copy_commits_only_once | 2.5 |
| F22 | last_unit_order_and_fresh_oversell_refusal | 1.5 |
| F23 | successive_orders_use_remaining_stock_and_own_tiers | 2.5 |
| F24 | restart_preserves_receipts_stock_and_retry_terminality | 3 |

All 24 are binary. F15–F22 and F24 are nine adversarial/replay criteria totaling 23, about 65.7% of functional weight. Final shares remain 0.6/0.2/0.2 with the strict Functional >0.05 floor. All catalogue checks plus unknown lookup total 1.25/35, below that floor, even if conservatively credited to a thin read-only shell. Historical-price credit F12 additionally requires a real new purchase. The constraints gate requires a new server order retrieved from a clean independent context.

## Public product requirements mapped forward

Source references are the current `instruction.md`, `environment/instructions/README.md`, `checkout-note.md` and `integration.md` under `projects/ridgeline-print-storefront`.

| Public requirement | Positive evidence | Refusal, boundary or independence |
| --- | --- | --- |
| Public shop without accounts or payment | Gates open populated shop; normal purchases and lookup run without sign-in | F14 accepts the checkout summary without requiring a separate review screen or payment/card form. |
| Eight prints, thirteen supplied SKU/size variants, exact metadata | F01 trusted table and all eight details | Missing, repeated or invented variants fail; all sizes include supplied regular price, paper, stock and trade offer. |
| Matching real photographs; larger detail photo | F01 compares each print's grid/detail image | Missing/placeholder or non-enlarged detail image fails, with no invented aesthetic threshold. |
| Available/sold-out state per size and whole print | F01 grid stock; F07 available Harbour A3 addition | F07 sold-out Harbour A2 and Allotment cannot be added; offered sold-out prices remain visible. |
| Grid uses lowest offered regular price, even sold-out sizes | F01 compares grid to thirteen variant facts | F05 sorts by that same grid price; equal-price ties are free. |
| Case-insensitive title search and clearing | F02 mixed-case hArBoUr then clear | Only Harbour remains, then all eight; size/paper/sort successes are not prerequisites. |
| Size filter includes offered sold-out sizes | F03 exact five-title A2 set then clear | Includes Harbour's sold-out A2; excludes all three non-A2 prints. |
| Stock-sheet filter | F04 exact Munken three-title set then clear | Wrong-paper prints absent; no dependency on size/search outcomes. |
| Both price directions | F05 five £37.95-from prints versus three £42.50-from prints, then reverse | Whole collection compared; no forced tie order or alphabetical prerequisite. |
| Both alphabetical title directions | F06 exact eight-title order then reverse | Independent initial full collection and title control; no price-sort prerequisite. |
| Per-variant trade thresholds and all-unit trade prices | F10 below/at/below threshold; F17 merged qualifying quantity | Different sizes do not pool; F14 different prints with equal trade rules do not pool either. |
| Repeated same-variant additions aggregate quantity | F17 add three then two, observed combined five and charged receipt | Repeated request-list entries or equivalent keyed combined quantity cannot evade stock/tier enforcement. |
| Offer before qualification, applied saving afterward | F01/F10 show offer and qualifying saving | F10 reducing quantity restores regular price and zero saving. |
| Visible regular-price gross, saving, postage and payable | F10/F14 compare all four amounts before commitment | F14 checks entered address too; visible grams and postage-band names are **not** required. |
| Basket changes recompute current pricing | F10 quantity changes, F11 weight-changing baskets | F16 fresh forged amounts rejected or authoritatively recalculated by server. |
| A3 90 g, A2 160 g; postage uses combined weight | F11 mixed-size preview arithmetic; F14/F23 correct receipt charges | These are calculation inputs, not mandatory customer-visible weight fields. Trade prices do not change sheet weight. |
| Inclusive 100/500/2000-g postage bands and collection above | F11 90 g→£1.75, 500 g→£3.20, 2000 g→£4.95 | 2090 g clearly collection-only with zero postage. Band names need not appear on screen. |
| Reload preserves this visitor's unplaced basket | F08 two Night Ferry A2 survive real reload at £132.20 | Empty/different basket or placed receipt cannot substitute. |
| Different visitors have separate baskets | F08 independent context B begins empty, adds only one Long Field A3; both contexts reload | Exact original A retained; no copied storage/shared-context tabs. Actual installed MCP recipe is supplied and independently proven. |
| Zero removes a line and stays empty after reload | F09 own successful add followed by zero/removal/reload | A permanently empty basket cannot pass. |
| Positive whole sheets and excess basket refusal | F07 adds one available Slack A2 | Increasing to two refuses and preserves last valid quantity with actual availability; F17 separately handles checkout quantities. |
| Required name/address line/city/postcode enforced server-side | F15 dedicated valid control and later new valid checkout | Four fresh missing/blank-component requests refuse without new reference, stock deduction or changed prior receipt. No postal-format policing. |
| Address and full amount breakdown before commitment | F14 observes all four amounts and entered address | Post-purchase receipt alone is insufficient; no extra screen layout requirement. |
| New reference retrievable outside original browser memory | Constraints gate writes one new order then loads it in clean context | Static seed/client-storage receipt cannot pass; F19/F23 fresh purchases get distinct references. |
| Unknown reference does not substitute an old receipt | F13 successful known lookup, unknown, then known again | Clear not-found outcome, no forced response status or exact message. |
| Basket reserves no stock; all lines commit or none at live availability | F18 retains A while B successfully consumes Harbour stock | A stale multiline request refuses server-side with both variants and B receipt unchanged. |
| Simultaneous buyers cannot share final copy | F21 own normal order establishes endpoint | Two concurrent fresh identities give exactly one winner; stock zero, not negative. |
| Exactly remaining stock may be purchased | F22 final Slack A2; F23 final three Long Field A2 | F22 fresh oversell attempt refuses without changing successful receipt or stock. |
| Checkout quantities positive/whole and variants real | F17 own real successful orders | Fresh zero/negative/fractional and valid-plus-unknown requests refuse atomically. |
| Server owns all charged amounts | F16 own correct £67.70 purchase | New attempt with forged unit/shipping/total either refuses unchanged or stores authoritative charge; old replay cannot mask validation. |
| Retried same attempt returns original receipt/reference once | F19 successful order then two exact replays | No extra stock deduction or ordinary stock-refusal substitution. |
| Reusing attempt cannot alter quantity or address | F19 preserves original request and receipt | Both changed-quantity and changed-valid-address requests refuse without mutation. |
| Deliberate new checkout can repeat same purchase | F19 genuinely new UI checkout | Different reference and exactly one additional decrement required. |
| Receipts retain original address/quantities/regular and charged prices/amounts | F14 fresh lookup of mixed order; F23 two separate orders | Later trade threshold cannot retrospectively discount first order. No unwritten visible weight/band requirement. |
| Historical price/status remains historical | F12 compares dispatched RP-100001 against real new current-price purchase | Both reread; neither borrows the other's prices/status. |
| New placed order cancellable through receipt UI | F20 real five-unit purchase then normal cancellation | Cancelled state visible and exactly five units restored. |
| Cancel preserves original receipt and restores stock only once | F20 fresh cancelled receipt/stock | Two cancellation replays do not restore twice. |
| Original retry cannot resurrect cancellation | F20 replays recorded original checkout | Same cancelled reference, no stock deduction or new placed order. |
| Dispatched order cannot cancel or restore stock | F20 successful cancellation establishes actual operation | Apply to RP-100001: refusal, dispatched status/original total, unchanged measured stock. |
| Restart preserves orders/statuses/attempts/stock without reseeding | F24 owns placed/cancelled controls and one real process restart | Exact references/status/addresses/figures/stock persist; retries terminal; repeated cancel adds nothing; eight/thirteen catalogue identities remain unique. |
| Comfortable on mobile | Polish responsive_layout at about390×844 | Essential content/control reachability, clipping and overlap are judged here. Visual responsive criterion explicitly excludes those same observations. |
| Responsive presentation | Visual responsive_consistency compares at least two surfaces across widths | Visual grouping, proportions and density only; simple column/drawer/scroll adaptation can earn full credit. |
| Keyboard access, labels and visible focus | Polish labelled_controls_and_focus uses real Tab navigation | Search plus two enabled controls visibly focus; no unrequested full keyboard-only purchase. |
| Light/dark and usable navigation | Polish theme_and_navigation changes palettes, returns from detail/basket | Readable real theme change and usable navigation; visual criteria assess presentation. |
| Visible ordinary-action feedback | Polish interaction_feedback searches/clears and adds unit | Observed acknowledgement required without regrading stock/price/persistence. |

## Runtime and honest observation limits

| Current integration requirement | Coverage and limit |
| --- | --- |
| `/app`, Node entrypoint, app working directory, port3000, reachable UI | Harness starts stated path; gates observe UI. File/package checks establish layout where available; HTTP success alone does not prove static serving internals. |
| Prompt successful GET `/api/health` | Constraints gate observes successful response; harness also waits for reachability. No invented JSON shape. |
| SQLite path `/app/app.db`, DB_PATH override, durable state | Harness supplies location/restarts; F24 observes durability. Browser behavior cannot identify the actual database engine. |
| React/Node/Express/SQLite and supplied runtime libraries | Environment/reference source checks establish supplied setup and golden use. No claim that browser appearance proves submitted framework/package identity. |
| Seed once; preserve orders/stock/retry states | F24 pre/post observations and its own reference replays; no hidden row enumeration or invented all-orders endpoint. |
| Copy supplied catalogue/images into app; no reliance on original `/assets` | Installer and isolated golden execution evidence; a browser alone cannot prove arbitrary submission file paths. |
| Public network during development/use; external browser fonts/scripts/CDN allowed | Current task environment/verifier network settings and public-network guard agree. CDN/off-origin assets are **not** grounds for failure. No offline browser-load requirement remains. |
| Single Node app with no external backend/data service | Harness launches one server; independent-context gate proves real shared server write/read. Browser evidence alone cannot rule out every hidden proxy/service implementation. |

The prior ledger's offline-asset rationale is obsolete under the current staged profile. User-authored playground snippet networking, in the separate Colderwater task, is a distinct product boundary and does not imply a shop-wide CDN ban.

## Allocation, fairness and evidence

The gate buys one Kiln A3:7→6. F14 mixed purchase:6→5. F15 valid control:5→4; its four refusals retain4; its fresh valid follow-up:4→3. F24 records S, normally3, creates/cancels one back to S, then buys one to end at S−1, normally2. Other reserved variants and all deep criterion objects remain unchanged. If an earlier write did not happen, later criteria use observed stock and require their own actual outcomes; a failed address probe stops additional bad purchases before draining the allocation.

Each new cheap control begins independently from all eight prints. Search/size/paper have separate0.1 weights; price/title separate0.15. Genuine linked behavior still needs its positive, negative and recovery legs in one criterion. Grams and bands remain calculation facts, with only the requested charge/collection status demanded in the UI.

`FUNCTIONAL_FIX_REVIEW.md` explains the false-negative repair, unchanged arithmetic, precise MCP proof and score effect. `check_contract.py` passes22 assertions; `source_audit.py` passes83 on current source and final extraction. `two-context-mcp-results.json` proves simultaneous visitor contexts through the installed browser tool. Prior deep golden proof remains applicable to unchanged code/criteria and is not presented as a new paid Oracle run.

Separating controls adds at most0.35 raw points; removing the two unsupported display bars can restore up to5 additional raw points. Conditional on gates/floor passing, combined published score delta is at most0.0918 under the actual score tool. Floor unlocking is discontinuous; the synthetic extreme0→0.5217 is recorded separately. None of these arithmetic cases predicts a model score or guarantees private platform acceptance.
