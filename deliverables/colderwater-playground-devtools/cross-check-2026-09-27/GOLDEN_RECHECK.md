# Independent final-archive golden recheck

Reviewed 27 September 2026 (IST). Candidate SHA-256: `b34abc10a29b36cd30a62263f476eaa8e3b5328ca5dd75927b2d155721c988f1`.

No new golden blocker was found. No task, rubric, solution or archive file was changed by this runtime reviewer. The review supports the previous local evidence; it does not establish an actual Oracle score or guarantee platform acceptance.

The wider parallel review subsequently identified two issues outside this golden application review: restart termination guarantees in `tests/test.sh`, and benign redirect handling in the bounded privacy criterion/prompt. Other owners are fixing and exercising those paths. The original `b34abc10a29b...` rubric hashes below apply to that original ZIP only. The application observations can carry forward to the replacement ZIP only after its 23 solution-file hashes are confirmed unchanged. They do not validate the changed harness or redirect wording; the separate affected-path probes must provide that evidence.

## Scope and identity

I read the final archive's 33 Functional, two gate, four Polish and six Visual criteria, then inspected the actual witness programs, assertions and results behind the previous evidence map. I did not treat an aggregate PASS count as proof of the described legs.

The ZIP was independently CRC-checked and extracted into `golden-extracted/colderwater-playground-devtools`. All 23 solution file digests match the previous final freeze. All five rubric file digests and all 45 criterion identities/types/weights match the evidence map; Functional remains 33 criteria with total weight 49.5. The 13 cited JSON result files contain no recorded failure. See `golden-archive-identity.json` and `golden-evidence-integrity.json`.

The solution installed from those extracted files in the fresh, uniquely named `colderwater-crosscheck-runtime-20260927` container using the already built `colderwater-agent:20260927-fullqc` image. Its log said `Colderwater ready on port 3000`. The new browser check used `colderwater-verifier:20260927-fullqc` and Chromium 152.0.7977.8. Both disposable containers were removed; pre-existing workspace containers were left alone.

## New observations against the extracted archive

`golden-flow-recheck.cjs` completed six independent assertion groups with no browser page errors. This is six groups, not six new rubric criteria or a repeated claim that every criterion was freshly rerun.

| Group | What the new execution proved |
| --- | --- |
| Served assets | Browser HTTP responses contain final JS SHA `8fcc61a9a431ad6ed70a08be24829bbbf0b3aa4966edc64d31608f56e8e13172` and CSS SHA `cbfa10c893727b30ffa575ebe5befb26043074162af99b24384c2864fe58b05d`. The changed source CSS has the same digest as the served CSS; the final executable JS is byte-identical to the previous runtime witnesses. |
| Gate flow | Real authored preview/log output; UI save; independent context initially has no cookies/origins; exact server identity/title/filename/source loaded in its library and again after reload; return to the original page and Run works. Four actual snippet read responses were seen in the clean context. |
| Cancellation after saved-library use | A was still awaiting its callback when B superseded it after 280 ms. At more than six seconds, B's DOM and current Complete status still held and A's late log was absent. Actual Stop showed a cancellation reason, retained B's rollback after its timer deadline, suppressed the stopped callback and allowed recovery. This adds explicit post-deadline DOM/current-status observations to the earlier log-focused witness. |
| Four independent error paths | Each path had a new own good control, failed candidate and recovery. JS `forEeach` reports user line 4; complete HTML `undefinedFunctionCall` reports line 6; delayed exception and rejected Promise report line 2. Each restores its own good preview and then runs new valid source. |
| Bounded private paths | `/app.db`, `/server.js` and `/package.json` each actually returned the 22-byte harmless JSON 404 payload. Ordinary Run still worked. This targeted golden observation complements, rather than replaces, the prior MCP exposure classifier's benign/leaky fixtures. |
| Presentation after failures | Both theme changes preserve title, filename, exact editor source, live preview and prior console. At 1440 and 390 px, document width stays within viewport, Run hover text contrast is 8.08 in dark mode and 4.97 in light mode, and mobile source editing/Run/Clear work. The original saved record remains exact after all unsaved runtime experiments. |

Details are in `golden-flow-results.json`. Screenshots: `crosscheck-1440-dark.png`, `crosscheck-1440-light.png`, `crosscheck-390-dark.png`, `crosscheck-390-light.png` and `crosscheck-mobile-live-preview.png`.

I visually inspected both desktop themes, the mobile light composition and the scrolled mobile live preview. Editor, saved library, preview surround and console are consistently separated and labeled; the light dirty label and hovered Run text remain readable. Mobile uses an intentional vertical stack; all surfaces are reachable. The full-page mobile capture does not paint the initially offscreen iframe content, so the separately scrolled live-preview screenshot and browser DOM assertion are the evidence that the actual output remains visible. There is no new reason in these views to contradict the attainable top Visual anchors, but that remains a human judgment rather than a paid judge verdict.

## Previous witness-leg audit

The paths in this section are relative to `../full-qc-2026-09-27/`. These observations were inspected and reused, not represented as newly executed in this cross-check. Several older broad probes are weaker; the later supplemental or final probes are the evidence for their missing precise legs.

| Criteria | Checked witness assertions |
| --- | --- |
| Both gates | `actual-mcp-probe.js` uses an actual independent context, checks empty storage, observes UI POST and exact server record on load/reload, leaves it saved, closes the extra context and returns to ordinary MCP. New flow independently repeats the product behavior. |
| `initial_examples` | `runtime/golden/probe.cjs` observes initial automatic output; `runtime/supplement/probe.cjs` selects a real editable example and then observes its own authored output. |
| `language_dispatch` | `final-runtime-details.cjs` verifies case-insensitive JS/CSS dispatch, HTML control button works before CSS, red heading and unchanged log after CSS, old handler does not emit, fresh JS has no old global/heading and produces its own log. The earlier probe alone was not used for handler cleanup. |
| `fresh_cancel` | Supplemental active-run status, under-four-second B activation, six-second absence of A log, actual Stop feedback/rollback and recovery are real assertions. New flow also checks DOM/current status after the deadlines. |
| Origin and network boundaries | `runtime/network/probe.cjs` tests all four parent read/write operations and unchanged host title/storage. It proves unprotected routed text/image controls work, attempts preview fetch and Image in separate runs, verifies refusal plus no handler deliveries, and proves recovery. |
| Private runtime files | `actual-mcp-probe.js`, `exposure-classifier.js` and large-controls program inspect bounded prefixes, require positive controls, classify inside automation and return metadata. Whole-app static synthetic files and misleading MIME fixtures are detected; SPA/denial/decoy/browser-source/frontend-manifest/long benign inputs do not create a false failure. This proves only the bounded representative probes, not universal confidentiality. |
| Unsupported families | `runtime/golden/probe.cjs` separately tries all five named families with last-good preview; `runtime/errors/probe.cjs` proves ordinary comment/string/HTML words are allowed. Recovery is observed. |
| Literal loop budget | `final-runtime-details.cjs` separately measures both literal loops from the run setup, retains each initial log, times host control response, checks deadline/rollback and then observes recovery. It supplements the older runtime probe's less precise timeout measurements. |
| Four error criteria | `runtime/errors/probe.cjs` independently establishes and restores an own good preview for each exact source and verifies user lines 4/6/2/2 plus recovery. New flow repeats all four after real cancellation. |
| Console levels/objects/controls | Supplemental script verifies four ordered level labels, expands nested object and array contents, tests all 40 ordered rows and measured duration, asserts scroll-up stays at zero, bottom follows, and Clear removes rows. Runtime probe supplies the level string ordering observation. |
| `auto_run` | Supplemental probe measures the actual pause, edits repeatedly for longer than two pauses, checks no intermediate version executes and only the final version appears. Runtime probe covers auto-off no execution, immediate queued cancellation and later manual Run of that same draft. |
| `pane_resize` | Final-runtime program measures actual editor width and preview height before/after both controls, checks usable pane rectangles, then confirms both values and geometric sizes after reload. |
| Editor basics/indent | Supplemental program compares rendered token colors for all three languages, verifies mono font/gutter, actual matching brace highlights, equal indentation on all lines, retained selection and exact outdent. |
| `save_load` | Supplemental program loads both independent records with exact title/filename/source, reloads and checks both UI and full server records. |
| `persistent_snippets` | Supplemental program uses an actual second editor at the stale revision, changes all three fields in the winner, proves stale conflict/retained draft/exact winner, then reloads latest, reapplies and saves a new revision that survives reload. |
| Title uniqueness | Supplemental and validation programs establish a successful rename, test current-revision collision/trim/blank/whitespace atomically, create a case-distinct title, load both exact records and prove successful unused-name recovery. |
| Stale rename | Golden program actually renames from an old UI revision, gets conflict, preserves dirty draft and exact newer server record, reloads latest and successfully renames without losing stored source/filename. |
| Independent copy | Supplemental program checks different identities with exact initial source/filename, edits only the copy, reloads exact records, proves duplicate-title create refusal without mutation and then a successful additional copy. |
| Delete | Supplemental program checks cancel, a successful control delete, stale delete after a newer write, newer/sibling preservation, actual current delete after reload and rejected update to the deleted identity. |
| Dirty transitions | Golden program separately rebuilds dirty title/filename/source before saved load, example, New and import; asserts cancellation preserves all fields and acceptance changes the workspace without modifying stored source. Budget/validation probes add title-only and filename-only warnings. |
| Native dirty leave | Golden program tests clean reload has no dialog, real keyboard editing causes actual `beforeunload`, dismissed reload preserves the draft, accepted reload works and saved original source remains. |
| Export | Library program waits for an actual download, checks its actual filename and reads exact downloaded bytes. It does not infer export success from a toast. |
| Import | Golden program checks uppercase extension, two seconds of no auto-off execution, real manual Run, save/reload, unsupported UI import retention, current-revision server refusal of unsupported/path filenames, unchanged saved record and a successful valid edit afterward. |
| Theme | Final presentation probe verifies both palette changes and restoration while retaining title/filename/source/preview/logs. New flow repeats retained state after runtime failures at both widths. |
| Keyboard shortcuts | Supplemental probe reads visible documentation, invokes Run/Save/Clear only through keys and checks actual rendered output, successful exact saved source and no old console rows. |
| Shared delayed budget/recovery | Budget program uses the exact 4000 ms callback delay, logs entry around four seconds, measures termination from original Run under eight seconds, restores good preview, reloads original exact saved source and runs it again. It does not substitute the older 50 ms delayed loop. |
| Process restart | `restart-full/browser-restart-check.cjs` creates Primary/Copy/Deleted through UI, records exact list and revisions; harness invokes the shipped restart MCP once; a new browser sees the exact library, loads/runs both surviving records, saves a new primary revision and confirms it through a fresh read while copy/deletion remain correct. The harness scores are explicitly synthetic plumbing output, not an Oracle result. |
| Four Polish checks | Final presentation program checks named controls and three real focus-visible Tab stops; reaches all mobile surfaces, executes mobile Run/Clear and observes acknowledgement; screenshots show identifiable editor/library/preview/console. |
| Six Visual topics | Final screenshots and new rendered review support readability, palette, grouping, hierarchy, coherent controls and sensible desktop-to-mobile composition. First five are assessed at desktop; mobile operability is owned by Polish. |

## Remaining limits

- No new golden application defect is established by this review; no solution patch is needed from the runtime/evidence side. The two separate harness/criterion fixes above still require their own evidence and final archive hash binding.
- The final ZIP is the tested artifact. Source-only or differently packaged future changes invalidate this artifact identity claim.
- Official rubric review, real LLM Oracle, real builder score and Visual judge rating remain unmeasured here. An Oracle score of 1 cannot be promised from deterministic browser witnesses alone.
- Model-score expectations remain an engineering estimate; this check generated no model score and made no paid calls.
