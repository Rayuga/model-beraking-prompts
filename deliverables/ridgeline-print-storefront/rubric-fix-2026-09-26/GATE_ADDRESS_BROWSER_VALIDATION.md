# Ridgeline golden: strengthened gate and delivery-address browser proof

All seven browser check groups passed on 26 September 2026. The run used the installed verifier Chromium **152.0.7977.8**, not a locally cached older browser. No paid judge call was made, and no task source was edited for this evidence run.

## Runtime and isolation

- Fresh disposable golden container: `ridgeline-gate-address-20260926` (removed after evidence capture).
- App image: `ridgeline-agent:20260926-hardening`, image ID `sha256:a416062e424303943f3eb61ee1a68d712059bd9ffb51188a6df96da2344ad164`.
- Verifier image: `ridgeline-verifier:20260926-hardening`, image ID `sha256:5170bf08c3bad63f36fb2b7201925e00cbbe1f4ed01a88d9e4280c1e62a9d8c3`.
- Installed via the current `solution/solve.sh` into an empty `/app`, then launched `node /app/server.js` from `/app`.
- Agent container had `--network none`; the browser container shared only its network namespace. Application URL was `http://localhost:3000`.
- Run: `2026-09-26T15:42:03.412Z` through `2026-09-26T15:42:07.935Z`.
- Actual browser interactions and observed requests/responses provide the assertions. No database-file or source-code inspection was used as scoring evidence. No existing run/container/database was reused or altered.

## Strengthened constraints gate

1. Browser navigation to `/api/health` returned HTTP 200.
2. A normal UI checkout purchased one Kiln A3 for the newly generated recipient `Gate Browser muik5ky6`. The browser captured the actual POST URL, headers, complete body, fresh checkout identity and HTTP 201 order response.
3. Kiln stock changed from 7 to 6. The generated reference was `RP-E0FA92F61E`.
4. A new browser context started with exactly `{ "cookies": [], "origins": [] }`; no browser storage was copied. Its initial storage contained neither the recipient nor order reference.
5. Through the normal Track an order form, that context requested the reference from the server. The HTTP 200 response exactly matched the newly created order, and the rendered receipt showed its unique recipient, one Kiln A3 and GBP 39.70 total.
6. Reloading that fresh context caused a second server read and retained the exact receipt. The gate order was left placed.

## New incomplete-address criterion

This focused run omitted the separate mixed-order criterion. Therefore its address-stage stock S was **6**, and its final stock was **4**. The complete suite also buys one Kiln in the mixed order and reaches the specified stock of 3 before the persistence criterion.

| Operation | Result | Kiln A3 stock |
| --- | --- | ---: |
| Ordinary UI positive-control order, complete address | New `RP-4EDE0D72C8`, HTTP 201, GBP 39.70 | 5 |
| Fresh attempt with only recipient name omitted | HTTP 409 `INVALID_ADDRESS`, no new reference | 5 |
| Fresh attempt with only address line 1 whitespace-only | HTTP 409 `INVALID_ADDRESS`, no new reference | 5 |
| Fresh attempt with only city omitted | HTTP 409 `INVALID_ADDRESS`, no new reference | 5 |
| Fresh attempt with only postcode whitespace-only | HTTP 409 `INVALID_ADDRESS`, no new reference | 5 |
| Separate new ordinary UI purchase with complete address | New `RP-7817DF059D`, HTTP 201, GBP 39.70 | 4 |

Every negative probe reused the actual observed successful operation's method, URL, content type and payload shape, changed one address component only, and used a fresh UUID attempt identity. Country and all other valid address fields remained unchanged. In-page same-origin `fetch` sent these requests to the server, independently of ordinary form validation.

After every refusal, fresh browser requests confirmed all thirteen variant stocks were unchanged and the positive-control receipt was byte-for-byte equivalent as a parsed JSON object. The valid follow-up used a different reference and checkout identity, demonstrating a new purchase rather than a replay. Both valid address orders also passed independent clean-context tracking and reload checks.

Final stock differed from the initial seed only by the three intended one-unit Kiln purchases. There were zero browser page errors. Four screenshots show the rendered receipts, including the independent-context results.

## Reproducible evidence

- `gate-address-start.sh`: clean golden installation and app launch.
- `gate-address-browser-check.cjs`: executable browser test and assertions.
- `gate-address-browser-results.json`: browser version, all seven outcomes, complete observed network exchanges, timestamps and final stock.
- `gate-address-evidence/gate-fresh-context-reload.png`: gate receipt from an independent browser context after reload.
- `gate-address-evidence/address-positive-control-fresh-context-reload.png`: valid control receipt.
- `gate-address-evidence/address-followup-fresh-context-reload.png`: separate valid purchase after the four refusals.
- `gate-address-evidence/address-followup-original-session.png`: final UI receipt in the purchase session.

Installer SHA256: `926a0dd3d71d4c47e4f1c7e251fab8b6ac405800c8d32d26904cc1afd26f40ed`.

Frontend app.js SHA256: `1a4865ce0989898e4a8ed349deb09b16b24bd773a5856738e11fbc426798db6e`.

Browser proof script SHA256: `947bfa6774caebe9b398396c508bb1f24fa05da1f45e9ed247069898b21cfae6`.

This is targeted deterministic golden proof for these changed checks. It does not claim that an unpaid local browser run is the platform's full QC or paid Oracle result.

## Follow-up: independent visitor basket persistence

The additional visitor-isolation leg of `ridgeline_unplaced_basket_survives_full_reload` also passed in shipped Chromium 152.0.7977.8. It used a second fresh disposable container, `ridgeline-basket-context-20260926`, installed from the same golden source with the same images and network isolation. That container was removed after the run.

- Context A added two Night Ferry A2 and retained exactly that variant, quantity and GBP 132.20 total after a full reload.
- Context B was a separate new context with empty cookies/origins and no copied storage. Its basket started empty. It added one Long Field A3 for GBP 39.70.
- Reloading both contexts left A with only its two Night Ferry A2 and B with only its one Long Field A3. Neither basket inherited or overwrote the other.
- Both baskets were cleared as cleanup. Zero purchase requests were sent, all thirteen durable stock values remained identical to the initial seed, and no page errors occurred.

The four passing groups, exact rendered basket lines/totals, empty initial context state and before/after stock maps are in `basket-context-browser-results.json`. Reproduction is in `basket-context-browser-check.cjs`; screenshots of both baskets after reload are in `basket-context-evidence/`.
