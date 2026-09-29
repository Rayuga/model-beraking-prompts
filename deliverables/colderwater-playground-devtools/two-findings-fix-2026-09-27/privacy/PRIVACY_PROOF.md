# Independent local privacy proof

**The revised bounded protocol passed all eight local cases.** The negative fixture that denies only the former three addresses is rejected for its exposed `/.git/config`, `/app.db-wal` and `/package-lock.json`. The golden denies all nine current candidates with HTTP 404. No task files were changed.

The proof used the installed **Playwright MCP 0.0.79**, its actual `browser_run_code_unsafe` tool, and pinned Chromium in `colderwater-verifier:20260927-final-cross-check`, with Docker networking disabled. It performed **72 candidate navigations**, an authored preview-and-console Run before and after each case, and actual working Run controls on all 18 SPA/redirect fallback pages. No model/provider/platform call was made.

| Local case | Observed outcome |
|---|---|
| Benign project-directory exposure denying only `/app.db`, `/server.js`, `/package.json` | Former three denied; three generated working files downloaded through the additional candidates. Correctly fails. |
| Ordinary denial | All nine HTTP 404 responses accepted. |
| Working SPA fallback | All nine return the working editor; authored preview and console Runs pass on each fallback. |
| Genuine public asset named `/server.js` | Its successful script request is observed during ordinary working UI use before the path probe. The file implements the fixture's functioning Run control and is correctly accepted as a public browser asset. |
| Redirect to workspace | All nine end at the working workspace and pass authored Run controls. |
| Denial carrying attachment headers | All nine HTTP 403 responses accepted as denial. Chromium emitted no download events here; simultaneous denial/download precedence was not empirically triggered. |
| No-content responses | All nine HTTP 204 responses accepted. |
| Current golden | All nine HTTP 404, with successful authored Runs before and after. |

The server-exposure fixture contains only generated benign files. The browser probe does **not** read candidate response bodies, implementation text, database bytes or downloaded contents. Its evidence is response/download metadata, actual working controls, and browser requests observed during normal UI use. It uses no source/body classifier, directory enumeration or traversal probes.

The tested privacy description SHA-256 is `77ebd63c699acf4640e116c56a5f70c5ab5751b11c2f7584a8a1799274d55547`, and it remained unchanged during execution. [privacy_binding.json](privacy_binding.json) passes 14 checks and binds the current criterion, golden source bytes and proof artifacts. [privacy_results.json](privacy_results.json) contains the observations; each case also has its raw MCP result.

The first attempt hit an evaluator-only setup error because this MCP execution context lacks the global `URL` helper. That attempt is preserved as [attempt1_tool_setup_error.json](attempt1_tool_setup_error.json). After correcting the proof's URL handling, the bounded retry passed. This was not treated as product-failure evidence.

This demonstrates the requested negative and positive distinctions locally. Nine representative paths do not prove absence of every possible disclosure route, and no hosted judgement or completion-time success is claimed.
