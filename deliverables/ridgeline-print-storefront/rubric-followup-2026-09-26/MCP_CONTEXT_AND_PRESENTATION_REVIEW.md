# Ridgeline follow-up: actual MCP capability and catalogue proof

The installed verifier **can open and use two simultaneous independent browser contexts**, even when its server starts with `--isolated`. The reported single-context limitation does not apply to `browser_run_code_unsafe` in this image. An explicit recipe makes this capability clear to the rubric reviewer without weakening the visitor-isolation requirement.

## Exact tool proof

The test launched the real `playwright-mcp` process over JSON-RPC with precisely:

```text
playwright-mcp --headless --isolated --executable-path=/usr/local/bin/chromium --no-sandbox
```

The server identified itself as Playwright `1.63.0-alpha-2026-08-05`. The tool was discovered through `tools/list`, then called through `tools/call`; this was not a substitute standalone Playwright script. The actual browser was Chromium `152.0.7977.8`.

In one `browser_run_code_unsafe` call:

- The MCP-owned context A added two Night Ferry A2, total GBP 132.20, and retained them after full reload.
- `page.context().browser().newContext()` created context B with exactly empty cookies and origins and no copied storage. A remained open at the same time.
- B visibly started with an empty basket, then added one Long Field A3 for GBP 39.70.
- Returning to A and reloading retained only its two Night Ferry A2. Returning to B and reloading retained only its one Long Field A3.
- Both baskets were cleared. No purchase request was sent and all thirteen stock quantities stayed unchanged.
- Closing only B returned the browser's context count from two to one. A remained alive, reloaded successfully, and the ordinary MCP `browser_snapshot` tool still operated on it afterward.

Minimal lifecycle recipe for a criterion:

```js
async (page) => {
  const browser = page.context().browser();
  if (!browser) throw new Error('Browser connection unavailable');
  const secondContext = await browser.newContext();
  try {
    const secondPage = await secondContext.newPage();
    await secondPage.goto('http://localhost:3000');
    // Perform the criterion's UI observations using page and secondPage.
    // Keep both contexts alive; reload each through its own Page object.
    // Discover application controls normally; do not copy browser storage.
    return { observations: 'return the actual measured outcomes here' };
  } finally {
    await secondContext.close();
    await page.bringToFront();
  }
}
```

Use that function as the tool's `code` argument. The complete test in `two-context-mcp.py` supplies all real UI operations and assertions. Performing the two-context scenario within one callback avoids needing ordinary tab-management tools to register the additional context. No shell operation, installation, source inspection or database access is needed inside the grading tool. The existing functional prompt explicitly permits browser automation and browser-visible/network evidence; it does not forbid creating browser contexts. The original context is preserved for subsequent criteria.

Evidence: `two-context-mcp-results.json` records initialization, actual tool schema, executed code, returned observations and the subsequent ordinary snapshot. `two-context-observations.json` extracts the measurements for easy review. Screenshots are `context-a-mcp-basket.png` and `context-b-mcp-basket.png`.

## Five catalogue outcomes

Each newly separate catalogue control passed through the actual installed MCP tool:

| Control | Observed result |
| --- | --- |
| Search | `hArBoUr` leaves exactly Harbour Mouth; clearing restores all eight. |
| Size | A2 leaves Harbour Mouth, Long Field, Night Ferry, Slack Water and Two Weathers, including Harbour's sold-out offered variant; clearing restores all eight. |
| Paper | Munken Pure Rough 240gsm leaves exactly Harbour Mouth, Slack Water and Two Weathers; clearing restores all eight. |
| Price order | Ascending shows five GBP 37.95 prints then three GBP 42.50 prints; descending reverses those groups. |
| Title order | Ascending is Allotment, Harbour Mouth, Kiln, Long Field, Night Ferry, Nine Windows, Slack Water, Two Weathers; descending is its exact reverse. |

Evidence: `catalogue-controls-mcp.py`, `catalogue-controls-mcp-results.json`, extracted `catalogue-controls-observations.json`, and search/size/paper/final catalogue screenshots. All thirteen stock quantities remained unchanged.

## Optional frontend asset allowance

The same MCP proof installed a browser route for one unique HTTPS `ridgeline-qc-cdn.invalid` script URL. Its handler fulfilled the script locally with HTTP 200 and no-store headers; no internet request occurred. An unprotected blank page loaded its marker first, then the golden page loaded the identical optional frontend script. Both requests reached the handler. Catalogue rendering and a real search still worked, and the injected marker/script were removed afterward.

Separately, parsing the current task metadata confirmed both agent and verifier `network_mode = "public"`. The public integration instructions explicitly allow external fonts/scripts/CDN assets while disallowing an external backend/data service. These are source-level policy assertions, separate from the browser capability proof; they do not claim that external connectivity was tested in the deliberately offline local container.

## Presentation overlap review

The previous polish `responsive_layout` checked whether mobile text and controls were obscured by overlap/overflow. The previous visual responsive anchors repeated obscured controls, clipping/collisions and mobile unusability. That was a real overlap in observable evidence.

The root agent's revised source now keeps mobile reachability and overflow in binary polish. Visual responsive consistency compares group proportions, density and composition across viewport sizes and explicitly excludes mobile reachability, operability, clipping and overflow from deductions. Its other five visual criteria use desktop views. This is a small presentation-only distinction; it does not change functional strictness or require a particular visual style. This subagent performed the review and evidence capture only and did not edit task source.

## Isolation and provenance

Fresh disposable app container: `ridgeline-mcp-context-followup-20260926`, using `--network none`; verifier containers shared its network namespace. It was removed after capture. Existing containers, prior run outputs and databases were untouched. No paid providers were called.

- Agent image: `ridgeline-agent:20260926-hardening`, ID `sha256:a416062e424303943f3eb61ee1a68d712059bd9ffb51188a6df96da2344ad164`.
- Verifier image: `ridgeline-verifier:20260926-hardening`, ID `sha256:5170bf08c3bad63f36fb2b7201925e00cbbe1f4ed01a88d9e4280c1e62a9d8c3`.
- Golden installer SHA256: `926a0dd3d71d4c47e4f1c7e251fab8b6ac405800c8d32d26904cc1afd26f40ed`.
- Golden frontend SHA256: `1a4865ce0989898e4a8ed349deb09b16b24bd773a5856738e11fbc426798db6e`.

The existing gate/backend/deep checkout proofs are reused explicitly because these follow-up changes affect rubric instructions, presentation boundaries and network policy rather than application code. This report does not claim another paid Oracle run or a full checkout-suite rerun.
