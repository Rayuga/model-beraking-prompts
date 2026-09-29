# Independent browser-only mock witness

26 September 2026. This is a local negative control, outside the task archive. It is not a paid judge run or an estimated model reward.

The deliberately incomplete fixture serves the real thirteen-variant catalogue and a successful health response. Its purchase endpoint returns HTTP 200 without storing an order. The browser invents the receipt/reference and saves it in localStorage. The original browser can reload and look up that receipt, even though the server's lookup response is 404.

The old gate's health and product-response observations succeed on this fixture. With the revised gate, an independent browser context starts without copied storage or cookies and looks up only the newly generated reference. The server returns 404, the UI reports not found, and the unique recipient is absent. Consequently the new shared write/read prerequisite is false. A successful HTTP write status and a same-browser reload are insufficient evidence of a server-backed order.

`mock_gate_evidence.json` records all six passing assertions for this negative witness, the observed request, new reference, unique recipient, and both lookup outcomes. `mock-original-browser.png` and `mock-independent-browser.png` show the conflicting results. The browser was the pinned verifier's Chromium 152.0.7977.8. The isolated container `ridgeline-qc-browser-mock-20260926` used its own server and no database, mounted task inputs read-only, and was stopped and removed after the run. No existing application state was touched.

The runnable fixture and probe are in `mock-fixture/`. They intentionally do not implement the full product or all scoring criteria. This evidence proves rejection of this concrete static-data/localStorage-order failure mode. It does not prove rejection of every possible deceptive server, identify a database engine, or measure the fixture's full weighted score. The golden's independent positive evidence is in `GATE_ADDRESS_BROWSER_VALIDATION.md`.

Two test-only setup problems were corrected before the successful run: the fixture's grid display rule initially overrode HTML hidden state; and reading an unconsumed POST response body through Playwright stalled. The final fixture enforces hidden state, and the bounded probe uses the observed successful status/request plus the separately captured lookup evidence. The initial fixture failure remains in `mock_probe_initial_fixture_failure.json`. Neither correction changed the task or golden application.
