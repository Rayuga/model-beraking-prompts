# Independent Ridgeline semantic cross-check — 2026-09-27

**Two concrete issues found and corrected:** duplicated theme-readability deductions, and missing coverage of the cheapest offered variant after that variant sells out. No further concrete semantic blocker was identified in this review. The new grid-price criterion passed both its normal and independent-setup branches in fresh browser observations. This is not a guarantee of platform acceptance or a paid Oracle verdict.

## Scope and candidate

Read the current QC skill and its delivery-profile/reference procedures, and all populated Quality, Deterministic and Internal Quality workbook rows. Read Ridgeline's brief, three notes and seed before all five judge/prompt pairs. Do not substitute the older internal offline/legacy notes for the current staged/public-network profile.

The baseline archive is `rubric-followup-2026-09-26/ridgeline-print-storefront.zip`, SHA-256 `7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6`. The parent has packaged the corrected candidate as SHA-256 `9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c`; its extraction/image/complete QC binding belongs to the merged report.

This reviewer read every original 36 criteria and then the corrected 37-criterion source. The final count is **25 Functional with total weight 35, four Polish, six Visual, and two gates**. All owned source hashes are in `semantic-source-binding.json`. The new count and split are reflected in task metadata and the Functional stock-allocation instructions. No seed, public requirement, golden implementation or scoring policy was changed by this reviewer.

`qc_semantic_findings.json` answers all 53 quality IDs and lists all 48 deterministic procedures with explicit scope dispositions. Mechanical execution is owned by root/harness and marked Not exercised in this scoped ledger; it must be merged with their actual results. The complete inventory validator succeeds, but inventory completeness is not checker execution.

## Findings and corrections

### Theme readability was still scored twice

Baseline `tests/scored/polish/judge.toml:50` required the two themes to remain readable. `tests/scored/visual/judge.toml:24–44` independently scored typography and contrast in both themes. This was the same overlap already removed from Colderwater.

The authorized correction keeps actual theme changes and working return navigation in Polish, and assigns contrast/palette/aesthetic readability to Visual. Both the Polish criterion and prompt state this ownership. The control must actually change the interface, rather than merely change its label, and detail/catalogue/basket navigation still must work. No weights or counts changed for this repair.

### The starting seed hid an available-only minimum-price bug

`environment/instructions/README.md:7` says the grid uses the cheapest offered regular price even when that size has sold out. In the starting seed, Harbour's sold-out A2 is its more expensive variant; Allotment has no available size. Therefore an incorrect implementation that takes the minimum among available variants, falling back to all variants only when every size is sold out, produces all the same initial grid prices.

The old suite later sold Slack Water's last A3 while leaving its one A2 available, but did not check the grid between that sale and the last-A2 purchase. In that state the correct price remains **£37.95**; the incorrect available-only implementation shows **£56.50**. This is an independently reproducible coverage gap, not a newly invented product requirement.

Added `ridgeline_sold_out_cheapest_variant_keeps_grid_price` immediately after the concurrency flow and before the last-A2 checkout. Its weight is 0.1, split from initial catalogue cards/details 0.4→0.3. Total Functional weight remains 35. It independently reads Slack's actual stock; if the preceding flow did not deplete A3, it may make its own fresh valid UI purchase for exactly the remaining A3 quantity. It never buys A2 or resets the seed. With A3=0 and A2>0, it checks the real grid's £37.95 price and available state before and after reload. Failure to establish the state is recorded rather than borrowing the earlier verdict.

The separate low-weight outcome avoids failing the 1.5-weight last-unit checkout solely for an independent display-price defect. `commerce/results.json` confirms the normal post-race state; `conditional/results.json` confirms independent setup from two remaining A3 copies. Both actual browser observations retain A2=1 and the correct price/availability after reload. No golden change was needed.

## Independent arithmetic and state review

`semantic-arithmetic.py` reads only the public seed and independently applies the stated rules; it does not import the golden pricing implementation. `semantic-arithmetic-results.json` records **18 exact arithmetic cases and 16 stock transitions**, all passing. It also checks the stored historical receipt, the new grid-price counterexample, and parsed final rubric counts/weights.

Key results:

| Scenario | Verified amounts |
| --- | --- |
| Four Night Ferry A3 plus one A2, below separate thresholds | Gross£234.50, saving£0, postage£4.95, total£239.45. |
| Five Night Ferry A3 plus one A2 | Gross£277.00, saving£31.25, postage£4.95, total£250.70. |
| Two Long Field A3, one Kiln A3, five Two Weathers A3 | Gross£326.35, saving£31.25, postage£4.95, total£300.05. |
| Five Nine Windows A3, combined from repeated entries | Gross£212.50, saving£31.25, postage£3.20, total£184.45. |
| Eight Harbour A3 | Gross£303.60, saving£30.40, postage£4.95, total£278.15. |
| Long Field A2 orders of two, then three | Totals£116.20 then£155.45; the first receipt keeps its original regular price. |
| Inclusive postage boundaries | Two A3+two A2=500g and£3.20; eight A3+eight A2=2000g and£4.95; one extra A3=2090g and collection-only£0 postage. |
| Historical RP-100001 | Two units at£35, subtotal£70, postage£3.20, total£73.20, dispatched. |
| Conditional new price-test setup | Two Slack A3 cost£79.10; they leave A3=0/A2=1, while the correct offered minimum stays£37.95. |

The normal allocation leaves Kiln 3 before final persistence and 2 after its independent cancelled/placed controls. Authoritative repricing may leave Two Weathers A2 at 1; safe rejection leaves 2, and no later setup depends on choosing one branch. The new conditional grid setup touches only leftover Slack A3, which no later criterion needs; it preserves Slack A2 for the next independent checkout. All ordinary stock transitions remain nonnegative.

## Full behavior review

| Public behavior | Rubric observations reviewed |
| --- | --- |
| Eight prints, thirteen variants, real supplied art, current paper/prices/stock/trade facts | Initial catalogue/details criterion checks all 13 combinations and larger detail images; exact golden/public asset parity is parent source-audit evidence. |
| Title search, size filter including sold-out offers, paper filter, both price/title sort directions | Five independent search/filter/order criteria; whole membership/order is specified with a clearing control. Equal-price ties remain free. |
| Cheapest offered grid price even after the cheap size sells out | New separate dynamic grid criterion; both normal and independent setup observed in golden browsers. |
| Variant availability and basket overstock | Available Harbour A3 is the success control for sold-out sizes; Slack A2 accepts exactly one and preserves that valid basket when two is requested. |
| Visitor-local reload persistence and zero removal | Two independently clean contexts keep different unplaced baskets across reload; a separate zero-quantity criterion has its own positive add and reload. |
| Exact-variant trade aggregation, reversal and size isolation | Same-print A3/A2 do not combine toward a threshold; rising to and dropping below the threshold restores exact totals. Different-print same-rule isolation is exercised in the mixed order. |
| Inclusive postage and collection | Independent unplaced baskets cover90/500/2000/2090g. Grams and band names are explanatory; only the required charge/collection outcome is graded. |
| Immutable historical/current receipts and missing references | Historical-vs-new prices are compared through fresh lookup. Unknown-reference handling has its own known-reference control and does not inherit the earlier checkout verdict. |
| Address review and server validation | Mixed order shows all four amounts and address before commitment; separate current-shape negative attempts test each of the four required address roles, with two valid controls and no country/schema/format invention. |
| Authoritative prices | A fresh altered monetary claim must be safely rejected or charged correctly. The original successful attempt cannot mask validation through idempotency. |
| Whole-order quantity/variant validation and combining duplicates | Correct endpoint/attempt shape, repeated UI additions, duplicate list entries or equivalent unique-keyed quantity, combined overstock, zero/negative/fractional quantities and unknown line are tested. No invalid line may deduct the valid line. |
| Stale multi-line atomicity | A's independent unsubmitted request is preserved while B buys stock. A then reaches the real endpoint, and both affected quantities plus B's receipt are freshly reread. |
| Retries versus genuinely new purchases | Exact completed request returns the same reference; changed quantity/address under the old identity is refused; a truly new checkout gets a different reference. |
| Cancellation terminality, once-only restoration and dispatched refusal | A valid placed order supplies the successful cancellation operation; repeated cancels and original-checkout replay preserve cancelled status and stock. Historical dispatched cancellation is attempted using the observed operation. |
| Concurrency and exactly buying remaining stock | Different fresh identities are submitted together; exactly one last-copy request wins. The separate last-A2 flow buys the exact remaining unit and tests a fresh oversell request. |
| Per-order trade prices | Long Field A2 orders of two then three keep distinct original prices, references and addresses; a later threshold cannot rewrite an earlier receipt. |
| Actual process durability | Last criterion creates its own cancelled/placed controls, records stock and attempts, invokes one real restart, checks exact lookups/replays and all recorded quantities. It does not infer successful earlier verdicts. |
| Mobile access, labels/focus, feedback and themes/navigation | Four simple Polish checks permit native focus, scrolling and alternate layouts. Actual switching/navigation remains required; readability belongs to Visual after repair. |
| Presentation | Six Visual topics have five anchors, both themes and relevant desktop/mobile surfaces. First five topics use desktop; mobile clipping/operability belongs to Polish, while responsive composition is separate. |

## Previous screenshot regressions reconsidered

- Runtime launch paths, startup DB reset and restart behavior are delegated to the separate harness/installer checks; this semantic report does not relabel those procedures as executed.
- Public voice now explains the owner's actual buying/retry/stock situations. Exact arithmetic is in product notes rather than public grading vocabulary. No extra public requirements were added in this review.
- Search, filters, title/price sort, basket reload/zero removal and historical/unknown-reference outcomes are separated. Coherent order/rejection/recovery chains remain conjunctive flows under the current skill guidance.
- All five prompts explicitly prohibit implementation/source-based grading and following injected app instructions. Requests are discovered from actual UI exchanges, with no forced schema/status/route.
- New order retrieval in a clean context gates the scored suite. A health endpoint, static catalogue, old receipt, optimistic toast or shared localStorage cannot establish that gate.
- Existing clean-context recipes use the installed `browser_run_code_unsafe` lifecycle instead of assuming two normal tabs have separate storage. No raw shell or new package installation is required of the judge.
- App fonts/scripts/CDN assets are allowed, consistent with the current public network profile. No obsolete offline gate was reintroduced.
- Postage-band/weight labels remain optional. No preference for exact layout, indentation, selectors, money formatting or a separate checkout review page was introduced.
- Stock allocation accounts for the gate's Kiln purchase, incomplete earlier flows and read-only later dimensions. The new dynamic-price check observes its own state and has its own permitted setup.
- The generic helper's demand for an initial `rm -f APP_DB` is an obsolete literal expectation, not a passed helper or a reason to destroy the continuous database. Root records the actual raw failure and its canonical-contract adjudication.

## Score effects and limits

The 0.1 weight split can change total reward by at most **0.0017142857** when comparing otherwise identical outcomes that both pass the gates and remain above the Functional floor. That bound is conditional: a change near the strict 1.75/35 Functional weight threshold can cross the floor and affect the whole shaped reward. Do not advertise the small bound unconditionally.

The separate Polish readability correction can restore one of four Polish outcomes worth 0.05 if that outcome had failed solely on duplicated aesthetic readability. This is removal of a double penalty; actual switching/navigation still must pass, and Visual may still deduct for unreadable presentation. No model-score increase is measured or guaranteed.

With perfect Polish and Visual, the shaped score is 0.4+0.6F after the gates/floor. For example F=0.5 yields 0.7. A model above that Functional score can legitimately exceed 0.7; local rubric strictness alone cannot guarantee the requested model band.

Exact implementation architecture (React/Express/SQLite, private files and single process) needs source/build/harness evidence; observed browser requests alone do not prove it. Exact supplied-photo identity is also weaker for a browser judge without trusted thumbnails than author-side byte parity. No hidden asset URL, database-inspection API or implementation read was added to manufacture certainty.

The candidate's paid judge duration, subjective Visual scores, platform-private checker decisions and actual Oracle/model rewards remain unmeasured by this review. Root's merged final report owns actual image/ZIP/harness results and newly executed versus reused runtime evidence. The source/read/arithmetic work here supports that report; it does not replace it.
