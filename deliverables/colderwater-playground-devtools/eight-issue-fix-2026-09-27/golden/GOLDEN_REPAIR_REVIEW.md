# Coldwater golden and keyboard repair evidence

The affected golden behaviors passed local browser tests. This is not a hosted Oracle run, a measured model score, or a guarantee of platform QC acceptance. The current 47-criterion index explicitly distinguishes new observations from older evidence for unchanged behavior.

## Actual edits

- Polish accepts native and standard editor escape sequences, including Escape followed by Tab, without requiring a visible application shortcut hint. The bounded keyboard route, actual key events, labels, visible focus and independent saved-snippet preparation remain required.
- The golden header now says `Local library` instead of `Local & offline`. Its existing helpful Escape-then-Tab hint remains optional from the rubric's perspective.
- Rebuilt only the affected public JavaScript and HTML reference using existing local Vite 7.1.7 and TypeScript 5.9.2 tooling. No package was installed and no build network access occurred. `build_binding.json` records exact tool versions and source/output hashes.
- No runtime, server, installer, styles, dependency or sample behavior changed. Compared with the earlier full-QC golden, `app-only-copy-delta.diff` proves the only TypeScript differences are the badge and previously added keyboard help/ARIA linkage. Twenty other solution files are byte-identical.

The new JavaScript is `public/assets/index-VduTT3aN.js`, SHA-256 `016976b4d2f058fadfff6d18dd14a4ee138eba496ac08e66ff840053aa7878a4`. Browser-served hashes match the built artifact. CSS remains unchanged.

## Fresh observations

| Evidence | Result and scope |
| --- | --- |
| `keyboard-proof-results.json` | Five groups passed on the shipped golden: served build, independent snippet preparation, actual editor→example→library→editor route, keyboard Run afterward, and desktop/mobile help/layout in both themes. No pointer, DOM click, programmatic focus or API call occurred during the graded route. |
| `undocumented-keyboard-proof-results.json` | The same five groups passed after only the Escape hint was removed from the temporary browser DOM. The real editor handlers were untouched. This is a concrete valid alternative proving that missing shortcut documentation does not prevent the required keyboard behavior. |
| `functional_repair_summary.json` | Six newly affected Functional scenarios passed through the installed Playwright MCP 0.0.79 with Chromium 152.0.7977.8. This summary references exact source artifacts and retained probe failures; it is not a provider grading result. |
| `../functional/browser_probe_results.json` | The separate Functional reviewer freshly proved both revised security criteria through actual MCP: golden blocks fetch and image deliveries with visible refusals and recovery; all three reserved URLs deny with 404. Fifteen groups include working route controls, a synthetic unrestricted execution that adds deliveries, and eighteen reserved-address outcomes covering valid denials, SPA/redirect fallbacks, downloads and unrelated files. |

The six Functional observations are independent language dispatch/CSS copying; completed-preview click after 6102 ms and key/input after 6107 ms; original run's shared deadline at 5005 ms; pending interaction's deadline at 5148 ms despite a second click at 2137 ms; real auto-run measured at 545–554 ms with both negative windows held for 3000 ms; and an actual dirty second editor surviving a stale UI save.

In that conflict test, B was open and dirty before A saved. A advanced revision 1 to 2, B's actual UI Save was refused, B retained its exact title/filename/source, and a fresh server read still matched A. B deliberately loaded the latest version, reapplied its edit, saved revision 3 and reloaded successfully. A replayed request was not substituted for B's draft.

Both desktop themes and both 390 px mobile compositions were visually reviewed from the final-built screenshots. The header, controls, editor, preview, console and library remain coherent and readable. The mobile stack intentionally scrolls. These observations support the attainable Visual anchors but do not assign a paid Visual score.

## Corrected test assumptions, preserved evidence

The first six-scenario run passed its first five groups but the stale-editor probe looked for `Load latest`; the application correctly labels the action `Reload latest`. The isolated rerun then observed fields before its asynchronous fetch completed. Those two probe assumptions were corrected, and only the affected stale-editor scenario was rerun. Both earlier results are retained as `functional-mcp-attempt1-selector.json` and `stale-draft-mcp-attempt2-observation-race.json`. The final isolated result is `stale-draft-mcp-results.json`. No application change was made to make those probes pass.

The initial keyboard bootstrap used unavailable `curl` for its readiness poll, printing startup warnings. The bounded poll ended and the actual browser successfully loaded and tested the healthy application. These warnings did not supply any pass evidence; all five browser groups ran. Future bootstrap uses Node's existing fetch support.

## Fairness checks

- A standard CodeMirror Escape-then-Tab editor without an application hint is accepted and has a real passing browser witness.
- Temporary host-page unresponsiveness during a supported loop is not a failure by itself. Timely termination, rollback and subsequent editing/running remain required. Previous golden evidence happened to prove stronger responsiveness; that extra observation is not reused as a requirement.
- Language dispatch does not inherit a delayed-interaction verdict. The new interaction criterion establishes its own document, handlers and completion before waiting.
- Original-run and later-interaction deadlines use their own positive controls. They no longer depend on a saved-library record or a prior criterion's verdict.
- Auto-run negative waits use measured delay plus margin, rather than stopping exactly at two seconds. A delayed incorrectly queued run cannot earn credit just because the observation ended early.
- Draft retention is observed in a real dirty editor, not inferred from HTTP refusal.
- The new reserved-address public note names the same three paths the criterion tests. The criterion uses visible denial/workspace/download outcomes and does not classify private source or database bytes. The separate Functional reviewer owns fresh denial/fallback/leak and network-control proofs.

## Scope and limits

The user's existing preview container on `127.0.0.1:3420` remains running with its original start time and state. All fresh browser tests used disposable, network-disabled containers and fresh databases. No paid provider call, hosted upload, commit or push occurred.

`GOLDEN_CRITERION_EVIDENCE.json` covers all 47 current identities and weights, with nine freshly observed criteria and no pending proof rows. Older broad runtime/server/restart witnesses are explicitly reused only because the corresponding implementation is unchanged; the whole current judge suite was not rerun end-to-end. The privacy/network owner's new artifacts are hash-bound in that index. The coordinator owns final source/archive binding, complete QC, harness changes and delivery.
