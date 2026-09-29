# Colderwater golden fix and new-rubric proof

The golden solution passed **65 local check groups**: 59 browser groups in the installed verifier Chromium **152.0.7977.8**, plus six isolated installer lifecycle groups. These are executable local checks, not a paid Oracle or platform QC result.

Only `solution/solve.sh` needed a solution change. The application already implemented the newly explicit runtime, library and dirty-draft behavior. Its TypeScript source and compiled runtime remain unchanged.

## Genuine defect fixed: reinstall inherited an old snippet library

The previous installer only copied files into `/app`. A prior `/app/app.db` therefore survived a golden reinstall. Startup correctly preserved that database and loaded its most recently saved snippet, so a reinstall could start with old user state instead of a fresh golden library.

The installer now checks that its bundled app files exist and that Linux `/proc` is available. Before touching files it checks open process file descriptors against exactly `/app/app.db`, `/app/app.db-wal` and `/app/app.db-shm`. If any is open it exits with an explicit instruction to stop the app; it kills no process. Once closed, it removes only those three exact paths and copies the golden app. Runtime startup and ordinary restart behavior remain unchanged.

The isolated lifecycle test passed:

1. Install and launch a fresh golden: empty saved library, with examples still shipped separately.
2. Create two records through the real API and update one to revision 2.
3. Attempt reinstall while running: exit 1, useful stop-app message, server still alive, all records identical.
4. Stop/start normally: exact titles, filenames, source and revisions persist.
5. Stop then reinstall: all three canonical database files removed; unrelated file and unrelated `.db` untouched; fresh library empty and old record lookups 404.
6. Create a new post-install record and restart normally again: that record persists exactly.

Evidence: `oracle-reinstall-check.cjs`, `oracle-reinstall-results.json`, `reinstall-app.log`.

## Positive browser proof for the stronger gates

`golden-browser-check.cjs` first confirms the existing startup example executes automatically. It then explicitly disables Auto-run, starts a new unsaved `.js` draft, enters newly authored `document.body.textContent` and `console.log` calls, presses Run, and verifies the new marker in the preview and console.

For the shared-storage gate it uses the normal UI to save one uniquely named `CW gate ...` snippet, records the actual successful write and complete server record, then opens a completely separate browser context. That context begins with `{ "cookies": [], "origins": [] }` and receives no copied state. The normal library UI obtains the new record from the server and shows its exact identity, title, filename and source. Full reload and another library load retain the same server record and exact editor source. The gate record is left saved and is not treated as a seed-count requirement.

The checks establish real shared write/read behavior. They do not infer the database engine or framework from browser traffic or use implementation files as scoring evidence.

Evidence: `golden-browser-results.json`; screenshots `browser-evidence/render-authored-marker.png` and `browser-evidence/constraints-clean-context-server-snippet.png`.

## New and clarified functional checks

| Requirement | Executed evidence |
| --- | --- |
| Unsupported execution boundary | Separate safe calls to `eval`, `Function`, `WebAssembly.Module`, an additional `Worker`, and dynamic `import` each produce clear refusal, retain the last successful preview and do not commit the candidate DOM. An ordinary recovery run succeeds. |
| Harmless unsupported-feature names | JavaScript string and comment containing all five names run; ordinary HTML text containing those names renders. No blanket text ban is inferred. |
| Four independently graded error cases | Each JS error, HTML error, timer error and promise rejection has its own good preview, failing candidate, exact user-code line (4/6/2/2), rollback assertion and successful recovery. |
| Stale rename | A successful rename advances the current version. Another editor's old-version rename refuses with conflict feedback, keeps its dirty source, and leaves the saved record exactly unchanged. Reload-latest followed by a valid rename succeeds. |
| Case-sensitive distinct titles | A title and its lowercase counterpart save as separate identities and retain their own exact source. |
| Blank title validation | Empty and whitespace-only titles are refused on otherwise valid current-revision requests. The existing title, source, filename, revision and timestamp remain unchanged. |
| Import filename validation | `nested/demo.js` and `unsupported.txt` are refused on otherwise valid current-revision requests without record changes. Uppercase `.JS` imports remain accepted. |
| Four dirty workspace transitions | Saved-record load, example selection, New and Import each warn about a dirty draft. Cancel preserves it; explicit discard performs the action; the stored original remains unchanged. |
| Title-only dirty draft | Editing only the title marks the draft unsaved and triggers the discard warning. Cancel preserves that exact title and the untouched source/filename; the stored record stays unchanged. |
| Filename-only dirty draft | Editing only the filename marks the draft unsaved and triggers the discard warning. Cancel preserves that filename; explicit discard opens New without changing the saved record. |
| Native leave warning | A clean saved record reloads without a warning. Cancelling native reload after a keyboard edit retains the unsaved source. Accepting reload then loading the saved record restores its saved source. |
| Import with Auto-run off | The exact frozen two-line `.JS` fixture leaves the previous preview and console untouched for over two seconds. Run then produces both imported markers. Saving and reloading succeeds; a `.txt` UI import and current-revision unsupported/nested filename writes refuse without changes. A later valid edit saves and reloads successfully. |
| One shared budget across callbacks | The exact callback fixture delayed by 4000 ms displays its candidate, emits `late-callback-entered`, times out and rolls back by **5436 ms from the original Run**. Reloading its saved good snippet and running it succeeds with its stored record unchanged. This distinguishes a shared deadline from a fresh five-second budget for the callback. |
| Preview network refusal | An unprotected `about:blank` control successfully loads locally routed HTTPS `.invalid` text and SVG resources first. Separate preview fetch and image runs then produce caught-refusal logs without either request reaching the route handler. Own-document DOM remains usable and ordinary recovery succeeds. No internet service, outage or CORS failure supplies the negative result. |
| Origin read/write isolation | The exact four parent document/storage read and write attempts all return blocked. Fresh host-side title and storage values are unchanged, and own-document recovery succeeds. |

Evidence: `golden-browser-results.json` (17 groups), `independent-runtime-results.json` (5), `validation-boundaries-results.json` (6), `title-and-shared-budget-results.json` (2), `network-boundary-results.json` (4), corresponding executable scripts, and screenshots under `browser-evidence/` and `independent-runtime-evidence/`.

The final frozen main script additionally tests all three dirty fields together before each of the four replacement actions, the combined safe-words HTML fixture exactly as specified, clean native reload, and the complete import/save/refusal/edit recovery chain. Its earlier successful run was repeated after those rubric details were frozen. The final network artifact contains `preview_probes` with two distinct runs, not one source in which a fetch failure could prevent the image attempt.

The QC agent separately verified the routed-resource setup through the actual installed MCP `browser_run_code_unsafe` tool against a deliberately unprotected mock. That confirms tool feasibility and demonstrates that requests from an unprotected preview are detected; this golden browser proof demonstrates that the protected preview sends neither request. The MCP capability evidence is in `network_probe_mcp_runtime.json` and `network_probe_mcp.py`.

## Existing behavior regression

The previous comprehensive scripts were rerun unchanged against another fresh isolated golden in the same shipped Chromium image:

- `runtime-regression/runtime-results.json`: all 13 groups pass, covering real editor startup, language dispatch and CSS isolation, error lines and rollback, opaque sandbox, literal loop deadlines with responsive host, Stop/new-run cancellation, late-callback suppression, timer runaway recovery, ordered expandable console, Auto-run behavior, indentation, theme and mobile layout.
- `library-regression/library-results.json`: all 12 groups pass, covering save/load/reload, rename uniqueness and recovery, independent duplicate, optimistic save conflicts and draft recovery, delete confirmation, import/export, native dirty navigation, pane persistence, console follow, keyboard shortcuts, syntax/bracket behavior, and renaming only stored title while retaining unsaved code/filename edits.

The regression scripts are the unchanged `browser-runtime-check.cjs` and `browser-library-check.cjs` in the sibling `hardening-2026-09-26` evidence directory. They were mounted read-only and their new outputs were written here. Their scripts do not record a browser version field themselves; they ran in the same verifier image and executable as the new scripts, which record 152.0.7977.8 directly.

## Runtime, build and provenance

- Agent image: `colderwater-agent:20260926-hardening`, ID `sha256:1cc17e2149f8aa79f918f5850687156212159927f0bbef646be3804f31e90aa4`.
- Browser image: `ridgeline-verifier:20260926-hardening`, ID `sha256:5170bf08c3bad63f36fb2b7201925e00cbbe1f4ed01a88d9e4280c1e62a9d8c3`.
- Browser executable: `/usr/local/bin/chromium`; Playwright module: `/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright`.
- Disposable containers: `colderwater-oracle-reinstall-20260926`, `colderwater-rubric-browser-20260926`, `colderwater-rubric-runtime-20260926`, and `colderwater-rubric-frozen-20260926`. Each used a fresh database and no external network; browser containers shared only their app container's network namespace. All were removed after capture. Existing run containers and databases were untouched.
- TypeScript 5.9.2 `tsc -p .../solution/app/tsconfig.json` passed with exit 0.
- Vite 7.1.7 production build passed with exit 0. `solution-before-build-manifest.json` and `solution-final-manifest.json` are identical: rebuilding reproduced every solution file byte for byte, including the existing `index-DlddEka4.js` bundle. Source, lockfile and built assets remain consistent.
- No dependencies were installed for this verification and no paid calls were made.

| File | SHA256 |
| --- | --- |
| `solution/solve.sh` | `cd35b7a83388dd057278b11433f58b9183ddc79468ef2ba2d1115b1c0eb85cda` |
| `solution/app/public/assets/index-DlddEka4.js` | `8fcc61a9a431ad6ed70a08be24829bbbf0b3aa4966edc64d31608f56e8e13172` |
| `solution/app/src/app.tsx` | `84a859af282b794ed88d387ad69d944c536bf0cf1cee1a3b4a479e8c8e4f60bf` |
| `solution/app/src/runtime.ts` | `d2fc0471003dd6a2107918be7a2d69f3a96027ec4c56266e6dd9b035a30efd86` |
| `solution/app/package-lock.json` | `c0a555b73ef1933a399d342f00fc215153304b2eb497e43e5f6989c9f9fb6f6b` |

The initial new-browser run stopped at a harness-only assertion: it assumed cancelling `beforeunload` always rejects `page.reload` with `ERR_ABORTED`. This Chromium version instead leaves the cancelled navigation waiting until the Playwright timeout. The app had correctly kept the draft. The assertion was corrected to allow both cancellation outcomes while still checking the actual dialog and unchanged source, then the complete new-browser script passed on another fresh installation. The initial result and screenshot are preserved as `golden-browser-first-attempt-harness-timeout.json` and `browser-evidence/first-attempt-harness-timeout.png`; they are not a golden application failure.
