# Independent Colderwater negative gate controls

26 September 2026. These fixtures and reports remain outside the task archive. No paid judge or model evaluation was run.

Two isolated, network-disabled containers used the installed verifier Chromium **152.0.7977.8** and localhost:3000. They used their own mock server and browser profiles, with no shared database or existing application state. Both health endpoints returned HTTP200, and both rendered editable code, a preview, console and recognisable controls. These satisfy the old explicitly observed health/surface checks; this is not a claim that a paid judge awarded an old full gate pass.

Both used verifier image `sha256:31bac530e99b6a63f0940d09ce63d6f79619f49e6fe556e286ea519188a454e6`. The containers were stopped and removed after their evidence was saved; the runnable fixture and scripts remain available.

## Inert editor

`inert-negative-evidence.json` records three passing assertions. A newly generated marker was entered as valid JavaScript using `document.body.textContent` and `console.log`. Clicking Run produced button feedback, but the preview and console retained their old example content. The new authored-run prerequisite therefore fails. `inert-run-noop.png` shows the entered code alongside the unchanged output.

This fixture has deliberately limited editing/presentation features. It was not scored against every functional criterion and is not asserted to earn the screenshot's full editor-only partial credit.

## Working runner with a browser-only library

`client-library-negative-evidence.json` records eight passing assertions. The new authored JavaScript really executed, satisfying the Run positive control. A normal Save then sent an observed POST and received HTTP201 with the apparent saved record. The server never stored it; the browser wrote it into localStorage. In that original context, reloading and selecting the saved title restored its exact filename/source.

An independent context began with zero cookies and no origin storage. Its actual server library read returned an empty list. The supposedly saved title was absent, and a reload still could not retrieve it. The new shared-storage prerequisite therefore fails despite the original success toast, successful HTTP response and same-browser reload. Screenshots compare `client-library-original-context.png` with `client-library-independent-context.png`.

These observations test one concrete client-storage failure pattern. They do not establish SQLite/Express, exclude every possible deceptive server, or determine the reward of a partially working real server.

## Scoring consequence and prior-review correction

The prior shell arithmetic is valid under its stated assumptions: editor basics1 + indentation1 + pane resize0.5 + theme0.5 =3/49.5 functional. With Polish and Visual at0.75, reward is `0.6*(3/49.5) + 0.2*0.75 + 0.2*0.75 = 0.3364` after rounding. That exceeds the functional floor, although code execution can still be absent. It is an analytic witness, not the measured score of either fixture above.

`mock_score_policy_check.py` runs the unchanged canonical scorer with four explicitly synthetic cases. The old analytic inputs produce0.3364; either new prerequisite set to failed produces0 even with all scored dimensions set to1; functional exactly0.05 also produces0. These fixtures verify scoring policy, not a provider's interpretation of the browser evidence.

The earlier review inspected valid scorer plumbing but accepted prerequisites that established only reachability and surfaces. It also overestimated how much same-browser reload proved about the library. The new paired positive/negative evidence addresses those specific gaps without making presentation criteria stricter or treating static labels as execution evidence.

## Actual MCP network-probe feasibility

`network_probe_mcp.py` launched the installed MCP server with the shipped headless/isolated/browser flags and invoked its actual `browser_run_code_unsafe` tool. A browser context route locally fulfilled a text resource and a tiny SVG under the reserved `cw-qc-network.invalid` host. An unprotected about:blank control fetched the exact text and loaded the 2-pixel image, proving CORS, resources and tool setup worked without internet access. The permissive mock preview then delivered both requests, so it correctly violates the new network criterion; ordinary DOM/console execution recovered afterward. The route handler and control page were removed.

`network_probe_mcp_runtime.json` preserves the actual tool return. This proof establishes tool capability and a concrete negative network outcome. Its permissive-mock source combines fetch and image because neither blocks there; the shipped criterion and golden positive evidence use two separate runs, so a synchronous refusal of one cannot hide the other. The golden proof in `network-boundary-results.json` shows both separately blocked before delivery. No application source was inspected for either verdict.

## Probe corrections

The first library probe read editor values before its asynchronous load completed; it now waits for the visible loaded state. A later response-body read stalled because the minimal fixture did not consume its own fetch response. The fixture now consumes those bodies, and the probe bounds body reads to ten seconds. Initial diagnostics remain in `client-library-initial-probe-race.json` and `client-library-unconsumed-body-progress.json`. These were test-only corrections, not task or golden changes. Final probes completed in a few seconds.

Runnable files are in `mock-fixture/`. The fixture's no-op server and localStorage behavior are intentional. Their code is not part of the shipped task or evidence a judge is instructed to inspect.
