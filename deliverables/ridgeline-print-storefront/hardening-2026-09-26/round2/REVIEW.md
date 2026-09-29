# Ridgeline independent browser review — 26 September 2026

**Local result: 49 browser assertions passed (45 main checks and 4 return-navigation checks).** Both simplified gates and all four polish criteria have direct browser evidence. Independent screenshot inspection found no defect that would prevent full credit under the six current visual anchors. This is local verification, not a paid Oracle or model result.

## Environment and integrity

- Verifier image: `ridgeline-verifier:20260926-hardening`; its actual `/usr/local/bin/chromium` reports **152.0.7977.8**.
- App: the running `ridgeline-preview` container, exposed externally on port 3310. Sharing its network namespace allowed the browser to use the grader's exact `http://localhost:3000` URL.
- The served `/assets/app.js` exactly matched the workspace golden file. Both SHA-256 values were `1a4865ce0989898e4a8ed349deb09b16b24bd773a5856738e11fbc426798db6e`.
- Desktop viewport: 1440 × 1000. Mobile viewport: 390 × 844. Captured all five surfaces in both light and dark themes at both viewports, plus keyboard focus: **21 screenshots**.
- No order was placed or cancelled. The temporary unplaced basket was emptied; every recorded stock value remained unchanged. No browser runtime exception or external app request occurred.

## Criterion coverage

| Current criterion | Evidence and outcome |
| --- | --- |
| Gate: `populated_public_shop_loads` | Populated public catalogue displayed eight prints; an actual product control opened Long Field's detail. Passed. |
| Gate: `application_health_and_server_data` | Browser received HTTP 200 at `/api/health`; observed actual `/api/prints` responses carried all eight displayed product titles and 13 variants. Passed. |
| Polish: `responsive_layout` | Catalogue and populated basket fit at 390 × 844; screenshots show readable essential controls and no obscuring panel. All 20 surface/size/theme captures also had no page-wide overflow. Passed. |
| Polish: `labelled_controls_and_focus` | Search, Size, Paper, Sort, basket and theme controls had identifying names. Actual Tab presses reached search, Size and Paper; all had visible 3 px outlines and `:focus-visible`. Passed. |
| Polish: `interaction_feedback` | Searching Long Field visibly reduced the catalogue to its matching card; clearing restored all eight. Adding one available A2 unit produced a visible confirmation and basket count 1. Removing it restored the empty basket. Passed. |
| Polish: `theme_and_navigation` | Both themes visibly changed the page palette. Direct detail → catalogue and basket → catalogue navigation passed independently at desktop and mobile sizes, without a stranded overlay. Passed. |
| Visual: `visual_typography` | Inspected catalogue, product detail, basket, checkout review and historical receipt. Headings, labels, totals and supporting text are readable and consistently distinguished. Meets the current 5-point anchor in this local review. |
| Visual: `visual_color_and_contrast` | Cream/forest palettes remain coherent in both themes; text, borders, totals and buttons remain distinguishable. Meets the current 5-point anchor in this local review. |
| Visual: `visual_spacing_and_layout` | Product groups, address blocks and pricing summaries have clear separation; no essential text or action was obscured. Meets the current 5-point anchor in this local review. |
| Visual: `visual_hierarchy_and_scanability` | Page context, primary actions, basket totals and receipt status are easy to locate. Meets the current 5-point anchor in this local review. |
| Visual: `visual_overall_craft` | Repeated navigation, buttons, type, spacing and summaries form a coherent shop throughout the reviewed surfaces. Meets the current 5-point anchor in this local review. |
| Visual: `visual_responsive_consistency` | Mobile headers wrap cleanly; products and transaction summaries reflow into readable stacked arrangements. Full-page mobile screenshots show reachable content beyond the viewport. Meets the current 5-point anchor in this local review. |

## Evidence

- [Main browser script](browser-criteria.cjs) and [45-check result](browser-criteria-results.json).
- [Exact return-navigation supplement](navigation-supplement.cjs) and [4-check result](navigation-supplement-results.json).
- Representative screenshots: [catalogue desktop](catalogue-desktop-dark.png), [catalogue mobile](catalogue-mobile-light.png), [detail desktop](detail-desktop-light.png), [detail mobile](detail-mobile-dark.png), [basket desktop](basket-desktop-dark.png), [basket mobile](basket-mobile-light.png), [checkout desktop](checkout-review-desktop-light.png), [checkout mobile](checkout-review-mobile-dark.png), [receipt desktop](receipt-desktop-light.png), [receipt mobile](receipt-mobile-dark.png), [keyboard focus](keyboard-focus.png).

The initial local probe checked the body's background colour, which is transparent in both themes because the actual background is painted by the root element. That probe failed after 40 successful assertions. The app was correct; the probe was changed to measure `document.documentElement`, and the complete main walk then passed. The initial diagnostic is preserved in `browser-criteria-results-before-probe-correction.json` and `failure.png`. No app or task change was made for this correction.

The receipt visual was the seeded dispatched order RP-100001; this round did not place a new order or retest cancellation, stock enforcement, retry recovery, pricing or restart durability. The earlier 203-assertion backend suite and functional browser/resilience evidence remain separate. Visual scores above are a direct local assessment against the written anchors; the platform judge can only be confirmed by its actual run.
