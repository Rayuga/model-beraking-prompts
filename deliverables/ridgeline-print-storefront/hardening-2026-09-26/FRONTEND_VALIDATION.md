# Ridgeline golden frontend validation

The replacement frontend is an editable, locally served React application. `public/assets/app.js` holds the application source and `shop.css` its responsive styles. `react-vendor.js` preserves the existing React/ReactDOM runtime and its license comments; no frontend package install or network asset is needed at runtime. The original eight print images remain unchanged.

The app now includes catalogue search, size/paper filters, sorting, print details with exact variant stock, per-line trade pricing, a persistent basket, address/review checkout, historical order lookup, cancellation and immutable receipts. Light and dark themes persist. Navigation, labels and controls work by keyboard; cancellation uses a native dialog with Escape and focus recovery.

Checkout recovery retains the original request identity, full submitted body and quoted summary. If a response is lost or the server returns an ambiguous failure, a dedicated recovery page replays the saved request. The basket and address remain locked until that attempt is resolved. Recovery works when the previous attempt consumed the final unit and the fresh basket preview now reports no stock. Definitive 4xx refusal releases the lock for correction.

## Local evidence

Tests ran against the actual golden Node/Express/SQLite app in the disposable `ridgeline-ui-hardening` Docker container, exposed at `http://127.0.0.1:3310`. Playwright used the bundled local browser tooling and cached Chromium. These are local checks, not a paid Oracle or model evaluation.

- `browser-check.cjs`: nine grouped checks passed on the final frontend: eight prints and images, search/filter/sort, theme persistence, mobile catalogue, excess-stock rejection, trade threshold/reversal, basket reload, checkout and receipt reload, cancellation/restoration, historical order protection, no browser runtime errors, and no external requests.
- `browser-resilience-check.cjs`: five grouped checks passed: a lost response after committing the **last** Slack Water A2 unit, exact retry after reload, blocked edits during the unresolved attempt, native dialog Escape/focus recovery, mobile basket/address/review/recovery layout, and a complete keyboard-only purchase with visible focus.
- The lost-response test deliberately allowed the real POST to finish on the server, then aborted delivery of its response to the browser. It verified stock reached zero, reloaded the page, recovered with the same original payload and checkout ID, received the same order with HTTP 200, and observed no second stock deduction. Cancelling returned stock to one.
- Quantity tests confirmed an over-stock request leaves the previous valid basket unchanged and reports actual availability. A stale basket remains visible with an actionable error.
- Screenshots and machine-readable results are in `ui-evidence/`. Desktop, mobile, dark theme, basket, checkout, saved-checkout recovery and receipt screenshots were visually reviewed.

The first fast keyboard test exposed a deferred navigation-focus race; focus was made synchronous, and the completed keyboard purchase passed. Source review also identified the last-unit retry gap; the saved-payload recovery flow and its targeted browser test were added before final validation.

The UI container contains disposable test orders, including one placed order from an early failed test. No database from this container belongs in the task package. The source seed remains pristine.
