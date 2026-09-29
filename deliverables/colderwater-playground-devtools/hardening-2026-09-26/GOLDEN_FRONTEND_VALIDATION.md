# Colderwater golden frontend and browser evidence

The downloaded golden contained a minified React/CodeMirror/Acorn application without editable application source or its build metadata. The revised golden includes `src/app.tsx`, `src/runtime.ts`, the preserved local vendor library, styles, a Vite configuration, a pinned package lock and generated browser assets. TypeScript 5.9.2 type checking and the Vite 7.1.7 production build both pass. Running the delivered app installs nothing and fetches no remote application assets.

## Changes and runtime boundary

- Retained CodeMirror's real line numbers, syntax colouring, bracket matching and selection indentation; retained the useful three-pane layout, themes and examples.
- Moved run lifecycle and source handling into editable TypeScript. Each run gets an opaque sandboxed frame. On localhost/127.0.0.1, the alternate loopback hostname provides renderer isolation on the same Node listener. Messages require both the active frame and run token.
- Source instrumentation checks literal loops and function/callback bodies against the run deadline. A parent watchdog supplies a second stop path. Dynamic evaluation/imports, workers and WebAssembly are refused; arbitrary blocking browser-native operations are explicitly outside the declared supported scope.
- Timers and Promise continuations are tracked. New runs and Stop detach the old frame and invalidate its messages. A per-run rollback document prevents uncaught errors, rejected Promises and timeout candidates from replacing the last successful rendered preview.
- Error feedback uses the user's source lines. The exact JS line 4, HTML line 6, timer line 2 and Promise rejection line 2 probes passed.
- Saved work uses the server's loaded revision. Conflicts retain the current unsaved buffer and offer Reload latest, followed by an optional Restore previous draft before a deliberate save.
- Rename writes only the stored record's title. Unsaved filename/source changes stay in the editor; they are not silently persisted by renaming. The loaded revision and saved baseline advance after success.

## Local browser results

The final browser checks used Chromium **152** from the actual pinned verifier image, against the real Node/Express/SQLite golden app. No paid judge, Oracle or target-model call was made.

`browser-runtime-check.cjs` passed 13 grouped checks. `browser-library-check.cjs` passed 12 grouped checks after the final rename correction. `browser-mobile-preview.cjs` separately confirmed that the rendered document survives resizing to 390 pixels and remains visible when the preview is scrolled into view. Full-page captures of an offscreen cross-process iframe can show an unpainted frame; `mobile-preview-visible.png` resolves that capture ambiguity.

The root agent additionally ran the real verifier `restart_app` MCP helper, reopened the app in a fresh Chromium 152 page and verified the complete restart workflow. Server mutation, validation, revision and durability checks are separately recorded in `backend_results.json`; they are combined with the UI observations below rather than being mistaken for a browser judge verdict.

| Functional criterion | Local evidence |
|---|---|
| `initial_examples` | Runtime suite: runnable first screen, console output, real editor, authored DOM replacement. |
| `language_dispatch` | Runtime suite: uppercase JS/CSS dispatch, full HTML, CSS preserves prior DOM without rerunning scripts, fresh JS drops prior globals. |
| `fresh_cancel` | Runtime suite: new run supersedes active four-second timer; actual Stop restores the prior completed preview; late callbacks remain absent. |
| `sandbox_isolation` | Runtime suite: own DOM works; parent document/storage reads and mutations are blocked; unsupported eval is refused; ordinary strings containing its name remain valid. |
| `timeout` | Runtime suite: braced and unbraced literal loops terminate; theme control stays responsive during execution; last-good preview survives. |
| `error_lines_preview` | Runtime suite: exact JS 4, HTML 6, timer 2 and Promise rejection 2 line numbers and rollback. |
| `console_levels` | Runtime suite: log/warn/error/info remain in original order with distinct labels. |
| `console_objects` | Runtime suite: nested object and array expansion expose actual values. |
| `console_controls` | Library suite: forty entries, duration, preserved scrolled-up position, follow-at-bottom, clear. |
| `auto_run` | Runtime suite: debounce, manual mode, disabling a queued automatic run. |
| `pane_resize` | Library suite: both separators change proportions; ordinary reload restores them. |
| `editor_basics` | Runtime/library suites: gutter, monospaced editor, JS/HTML/CSS colour tokens and real matching braces. |
| `editor_indent` | Runtime suite: multiline Tab and Shift+Tab preserve the selected source and restore exact original text. |
| `save_load` | Library suite: distinct exact fields and identities survive loading each record and reloading the page. |
| `persistent_snippets` | Library suite: two live editor snapshots, stale-save conflict, preserved draft, Reload latest/Restore draft/Save recovery; server checks cover exact unchanged fields/revisions. |
| `rename` | Library suite: valid rename, title-collision refusal and recovery; extra dirty-draft rename regression; server checks cover trimmed collisions and no mutation. |
| `duplicate` | Library suite: separate copy identity and independent later edit; server checks cover duplicate-title refusal and revision independence. |
| `delete_confirm` | Library suite: cancel keeps the record, confirmation deletes only the target; server checks cover stale delete and deleted-identity update refusal. |
| `dirty_navigation` | Library suite: cancelled navigation retains edits; real browser beforeunload dialog appears and can be dismissed. |
| `import_export` | Library suite: exact exported filename/content, uppercase `.JS` import and save, unsupported import leaves the buffer unchanged; server checks cover invalid extension rejection. |
| `themes` | Runtime suite and screenshots: coherent light/dark themes and responsive layout. |
| `keyboard` | Library suite: documented Run, Save and Clear shortcuts perform the actual operations. |
| `recovery_persistence_chain` | Runtime suite: literal infinite loop inside a timer terminates and rolls back; valid execution recovers. Library/server checks preserve the saved source independently of bad editor buffers. |
| `persistence` | `browser_restart_harness.log`: actual verifier restart, exact identities/revisions/source and deletion state, both saved programs execute, later primary save leaves copy unchanged. |

Results and screenshots: `ui-evidence-chromium152/`, `ui-evidence-library152/`, and the root restart harness log. This is local evidence of the implemented contract; an external model-judge score remains unmeasured.

## Final SHA-256 hashes

| File under `solution/app` | SHA-256 |
|---|---|
| `src/app.tsx` | `84a859af282b794ed88d387ad69d944c536bf0cf1cee1a3b4a479e8c8e4f60bf` |
| `src/runtime.ts` | `d2fc0471003dd6a2107918be7a2d69f3a96027ec4c56266e6dd9b035a30efd86` |
| `src/vendor.js` | `846282ffed26393f3724b82d9985b690cf9f40c1d839e578b4fb385fbc1d74db` |
| `package-lock.json` | `c0a555b73ef1933a399d342f00fc215153304b2eb497e43e5f6989c9f9fb6f6b` |
| `public/assets/index-DlddEka4.js` | `8fcc61a9a431ad6ed70a08be24829bbbf0b3aa4966edc64d31608f56e8e13172` |
| `public/assets/index-BiHNfby7.css` | `46c9eee773e9f3017106c4c86d5480bb2feab9866a3e7589f868846eb746d892` |
