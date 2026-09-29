# Ridgeline golden cross-check

Final candidate SHA-256: `9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c`.

No golden application defect was found. The fresh browser evidence supports all 31 binary criteria (25 Functional, two gates and four Polish). A fresh rendered review supports the six attainable Visual anchors. These are local observations, not a paid Oracle score or a guarantee that the platform judge will award 1.

The complete 37-criterion map is in `GOLDEN_CRITERION_MAP.md`, with structured evidence and final rubric hashes in `GOLDEN_CRITERION_EVIDENCE.json`. Functional weight remains 35 after the new 0.1-weight cheapest-sold-out check. No golden source edit was needed.

## Exact artifact and isolation

I independently CRC-checked and extracted baseline archive `7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6`, compared all 19 solution-file hashes with current source, and installed that solution into a fresh disposable container/database. After the other reviewers fixed the harness and rubric, `build_golden_map.py` verified all 19 application hashes are identical in final archive `9944734b...`. Therefore the new application observations apply to the final ZIP even though its harness and criterion text changed. `golden-archive-identity.json` records the baseline; the final map records both identities.

Actual app images were `ridgeline-agent:20260926-followup` and browser image `ridgeline-verifier:20260926-followup`; Chromium was 152.0.7977.8. The final image rebuild and changed harness validation are independently bound by the harness reviewer. No existing workspace database/container was used. The main flow used `ridgeline-crosscheck-runtime-20260927`; the new criterion's independent branch used `ridgeline-crosscheck-conditional-20260927`. Both and their one-shot browser containers were removed after evidence capture. Their app logs reported normal startup on port 3000.

## Newly executed evidence

| Program/results | New observations |
| --- | --- |
| `gate-address/probe.cjs`, `gate-address/gate-address-browser-results.json` | Seven groups passed: real UI Kiln purchase, observed server write, independent empty-context normal lookup/reload; separate valid address control, four server-side missing/blank component refusals without stock/receipt changes, separate successful fresh UI purchase afterward. |
| `commerce-flow.cjs`, `commerce/results.json` | Thirteen groups passed in one continuous app database: all eight cards/thirteen variant details; real basket stock boundary and zero-removal; visible trade/postage totals; historical/new receipts; mixed-price checkout; fresh forged-price repricing; duplicate/invalid-line atomicity; stale multiline rejection; retry identity and new purchase; terminal cancellation/dispatched refusal; actual concurrent last-copy requests; last-unit oversell; successive orders' independent trade tiers. It captures 100 browser-side network observations, including actual UI write payloads and durable rereads. |
| `conditional/results.json` | The new cheapest-sold-out criterion passed its independent setup: observe two Slack A3 remaining, buy exactly those via normal UI, then see A3 zero/A2 still one and grid price still GBP 37.95 with available status after reload. The main commerce flow separately proved the inherited race-created zero-A3 branch before consuming A2. |
| `remaining-ui-legs.cjs`, `commerce/remaining-ui-legs-results.json` | Four precise gaps closed: Allotment is priced and its purchase control disabled; Night Ferry A3 changes 4 to 5 to 4 in the same mixed basket with exact per-line prices and all totals; rendered mixed receipt shows the individual prices and complete saved address; known/unknown/known UI reference lookup recovers properly. |
| `mcp/two-context-mcp.py`, `mcp/two-context-mcp-results.json` | Exact installed `browser_run_code_unsafe` mechanism retains two distinct browser contexts simultaneously. Their different exact baskets survive reload without cross-contamination; both are cleared without any purchase or stock change, and ordinary MCP still works after the added context closes. |
| `mcp/catalogue-controls-mcp.py`, `mcp/catalogue-controls-mcp-results.json` | Exact installed MCP proves the five independent search/filter/sort outcomes, exact full membership/order and clear/reset controls. A locally routed external-style script works while the app remains functional, without an actual internet request. |
| `presentation/probe.cjs`, `presentation/browser-criteria-results.json` | 45 presentation assertions passed, with 21 fresh screenshots. All five surfaces were captured in light/dark at 1440px and 390px; actual keyboard focus, visible search/add feedback, navigation, basket cleanup and unchanged durable stock verified. Served frontend bytes match the mounted golden source. |
| `browser_restart_results.json` (harness reviewer) | Independent own UI cancelled/placed Kiln controls survive the actual shipped MCP restart from PID 30 to 196. Fresh browser retrieves exact statuses, addresses and amounts; checkout/cancel replays remain terminal; all thirteen stocks, eight prints and historical receipt remain exact. No score is inferred from a synthetic harness reward. |

`build_golden_map.py` also validates all 14 fresh successful UI purchase receipt lines against the canonical seed's quantities, regular/charged unit prices and line totals, and verifies every saved address component matches the corresponding observed request. This assertion examines newly recorded server responses; it is not implementation-source grading.

The address suite ran before the mixed order in this local sequence, so its own baseline S was 6 and then 4. The mixed order subsequently takes one more Kiln and leaves the expected three for an independent restart setup. The changed criterion order did not borrow assumed stock: each meaningful mutation was checked against observed live state. The separate restart reviewer started a different fresh DB with S=7, as explicitly permitted by that criterion's independent setup.

## Witness review and retained evidence

I read the public brief, all three instruction notes, exact seed, all final criteria and prior detailed browser/backend/installer programs. Older broad scripts alone did not provide some precise legs (for example whole-list sorting, same-basket trade reversal or every required address field); the fresh MCP, supplement and address evidence above supplies those observations. This report does not promote the older aggregate PASS counts to fresh results.

The unchanged installer regression is reused from `../rubric-fix-2026-09-26/oracle-reinstall-check.cjs` and `oracle-reinstall-results.json`. Its seven assertions cover exact fresh seed, real purchases, active-database install refusal without mutation, normal restart durability, stopped reinstall removing only the canonical database/sidecars, restored seed/historical receipt, and durable post-reinstall writes/retry identity. Its installer SHA is `926a0dd3d71d4c47e4f1c7e251fab8b6ac405800c8d32d26904cc1afd26f40ed`, unchanged in this final solution. This lifecycle evidence is reused explicitly; no installer rerun is claimed here.

## Visual judgment and limits

I inspected fresh catalogue light desktop, detail dark desktop, basket light mobile, checkout light desktop and receipt dark mobile screenshots. Typography, photographs, prices and controls are readable; grouping and treatment remain consistent across all five surfaces. Mobile uses a coherent stacked layout with reachable controls. No new visible issue contradicts the rubric's accessible top anchors. The first five Visual topics are judged on desktop and responsive composition separately from Polish's mobile operability.

No app runtime page errors were recorded by the new programs. The remaining uncertainty is the real judge/builder behavior: no paid Oracle, model or aesthetic evaluation was run. Local evidence supports full golden capability but cannot guarantee a score of 1 or promise the target model will stay below a chosen reward. Future application changes must rebind these file hashes and repeat affected evidence.
