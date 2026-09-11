# PatchPad Oracle and model run review

Reviewed all four supplied run folders: one Oracle, one no-op and three model trials.
All five trials identify the same platform task checksum. All 39 recorded criterion
descriptions and weights match the Docketlight-weight upload before this repair.
The exported Oracle app is byte-identical to the current golden app.

| Submission | Final reward | Functional | Functional passes | Polish | Visual |
| --- | ---: | ---: | ---: | ---: | ---: |
| nop | 0.0000 | 0.0000 | not graded | 0.0000 | 0.0000 |
| oracle | 0.8877 | 0.8795 | 24/27 | 1.0000 | 0.8000 |
| gemini-3.7-flash | 0.5678 | 0.5241 | 14/27 | 0.6667 | 0.6000 |
| claude-haiku-4-5 | 0.3033 | 0.0000 | 0/27 | 0.6667 | 0.8500 |
| gpt-5.4-mini | 0.5291 | 0.2651 | 7/27 | 1.0000 | 0.8500 |

## Oracle diagnosis

Oracle scored 0.8877, with Render, Constraints and Polish all 1.0. Three
Functional checks lost 2.5 of 20.75 criterion-weight units. All three pass
a fresh local browser reproduction against the unchanged exported/golden code:

- Tab: the judge reported a result-assembly exception that lost intermediate text. Separate persisted checkpoints reproduce the full Tab, Shift+Tab, Undo and Redo sequence successfully.
- Autoscroll: the judge reported real scrolling and ALPHA-0010 through ALPHA-0060 selected, but rejected its own gutter starting point. The brief does not forbid a supported gutter selection. Local real glyph-start drag and exact 51-line keyboard selection both pass.
- Clipboard: the judge cut EXTERNAL-C instead of targeting EXTERNAL-B plus its tab and CELL. The corrected setup selects that exact second line; paste, copy, cut, one Undo, whole-document copy and reload discard all pass locally.

These are evidence/procedure failures in the supplied Oracle reasoning, supported by the local reproductions. Native judge tool-call transcripts were not included, so this review cannot reconstruct every original action independently.

Visual scored 0.8: typography, spacing, hierarchy and craft were each rated 4/5, while colour was 5/5. RewardKit 0.1.7 normalizes raw 4 to 0.75, not 0.8. The judge described a cramped preview, weak report-section hierarchy and blank lower scroll space. Local screenshots support the preview concern. These visual findings are not erased or reclassified as judge errors.

If the three Functional checks pass on a fresh judge run and all other scores stay unchanged, the arithmetic would be 0.6*1 + 0.2*1 + 0.2*0.8 = 0.96. This is a conditional calculation, not a new Oracle score or a guarantee of platform acceptance.

## Model analysis

### Gemini 3.7 Flash — 0.5678

Passed 14/27 Functional checks. The judge explicitly missed initial list and dirty-state evidence, skipped Undo before the Delete leg, failed tail/middle setup, and replaced NEXT on line 19 instead of line 18. Those verdicts do not establish the corresponding product defects. Unicode and Find failures also involved toolbar focus or stale selection. Some drag and multi-caret results used wrong glyph positions. Restore/Undo was reported incorrect, but without a native action trace its cause remains uncertain. Visible history overflow was independently identified by both Polish and Visual; the exported layout should be investigated as a product defect. No corrected model score is claimed.

### Claude Haiku 4.5 — 0.3033

All 27 Functional verdicts were zero, but the reasons are mixed. Clear defects include incorrect seed expansion (ALPHA-1 instead of ALPHA-0001), doubled typing/movement/deletion, failed clipboard insertion, and a revision preview exception. Exported source corroborates these: src/db.js ignores generatedLineNumberWidth; the hidden input and its ancestor both route keydown to handleKeyDown without stopping propagation; the constructor sets this.previewRevision=null, shadowing the method of the same name. The hidden textarea alone is not a constraint violation when only used as keyboard plumbing. Later API/restart checks were unverified after Playwright transport failure, not demonstrated server failures. Its roughly 30% reward came entirely from Polish and Visual, illustrating the outstanding score-floor concern; it does not establish that every workflow was broken.

### GPT-5.4 mini — 0.5291

Passed 7/27 Functional checks. Clear defects include unpadded seed markers and accepting string baseRevision; server.js explicitly expands with String(i) and coerces numeric strings in parseInteger. The reported final invalid-save probe returned HTTP 200. Other zeros were caused or complicated by lost dialog/checkpoint evidence, typing on the wrong line, clipboard commands while a Find button had focus, and incomplete restart observations. Multi-caret and restore failures need a valid focused reproduction before being called confirmed product defects. Low score alone is not evidence that all these features are absent.

### No-op — 0

The no-op submission returned reward 0 with graded=0 and no_op=1; it was not a complete 39-criterion judge evaluation.

## Changes and validation

Only three Functional descriptions and the shared Functional prompt changed. They now use numbered steps, immediate plain-text checkpoint capture, verified focus/targets, supported gutter anchors for offscreen selection, and one bounded restart of a demonstrably invalid unsaved-only judge attempt. An observed app failure cannot be retried into a pass; saved/API/restart criteria cannot use that recovery.

All IDs, individual and judge weights, 39 criteria, runtime, golden code, brief, Visual rules and final gated 60/20/20 formula are preserved. The first four fairness fixes remain. Other previously deferred design/keybinding assumptions remain deferred.

Local browser evidence: oracle-three-results.json, oracle-checkpoints.json and oracle-three-failures.cjs.log. This uses a cached Linux verifier image with real Chromium keyboard, mouse and clipboard operations, on a fresh disposable app and without network access. It is not a full LLM Oracle run. The configured OpenAI credential is unavailable in the local environment, so a fresh complete Oracle must run on the platform.

The archive passes 108 local structural checks and exact preservation/ZIP validation. Local checks cannot certify the platform semantic rubric review.

## Complete criterion evidence

The following are the exported judge observations, not silently revised verdicts. Full scores, weights and provenance are also in run-analysis.json.

### nop

Run: `run-1bea0cf2-9fde-4c58-9302-86f42c979f49`; [original trial](../../../run-outputs/patchpad-editor-v2/run-1bea0cf2-9fde-4c58-9302-86f42c979f49/patchpad-editor-v2__mfAgRX3/result.json).

### oracle

Run: `run-1bea0cf2-9fde-4c58-9302-86f42c979f49`; [original trial](../../../run-outputs/patchpad-editor-v2/run-1bea0cf2-9fde-4c58-9302-86f42c979f49/patchpad-editor-v2__vz8tWSJ/result.json).

#### constraints

- **same_origin_application_shell** — 1.0: Root, app.js, and all observed API requests were same-origin localhost; inline styles had no external runtime assets. The incident report loaded successfully from GET /api/documents/incident-alpha, and there were no console errors.
- **self_contained_entry_and_reload** — 1.0: The root rendered a visible custom DOM editor with the report title and content. A full reload restored the same usable editor at http://localhost:3000/ without external navigation or build/install steps.

#### functional

- **seed_document_integrity** — 1.0: Exactly one document at revision 1 with 1,226 lines. Required lines matched, including line 1, line 18 NEXT, line 24 ALPHA-0001, line 623 ALPHA-0600, line 1223 ALPHA-1200, Reviewer notes, and OMEGA-END-ANCHOR.
- **custom_editor_surface_real_input** — 1.0: Real mouse focus and normal keyboard input inserted CUSTOM-SURFACE-PROOF exactly once; UI became Dirty, and unsaved reload removed it. Editor was a custom DIV textbox.
- **unsaved_edit_discard_on_reload** — 1.0: Typing UNSAVED-SHOULD-DISAPPEAR made the UI Dirty. Reload removed it; fresh GET content and revision 1 matched the complete recorded baseline.
- **noop_save_revision_invariant** — 1.0: Save was disabled. Three Control+S presses preserved revision 1, content length 159334, one history entry, and Saved status.
- **edit_save_reload_and_fresh_client** — 1.0: BASIC-SAVE-CHECK was absent, typed once, and saved once from revision 1 to 2. After clearing client storage, fresh content/revision matched exactly with one suffix.
- **keyboard_navigation_exact_coordinates** — 1.0: One-based counters were consistent. Required checkpoints matched Ln/Col 1,1; 5,1; 5,9; 6,9; 6,1; 5,9; 6,1; 6,59; 5,9; 6,59; and final 1226,63 with visible carets.
- **word_navigation_and_selection_shortcuts** — 1.0: NORTH WIND used the exact keyboard path. Control+Right reached Col7; Shift selection copied NORTH plus trailing space, and reverse selection copied WIND at Col7. Reload removed the line.
- **backspace_delete_exact_line_join** — 1.0: JOIN-LEFT/JOIN-RIGHT/JOIN-TAIL were created exactly. One Backspace and one Delete each produced JOIN-LEFTJOIN-RIGHT/JOIN-TAIL; one Undo restored all three each time. Reload persisted none.
- **tab_indentation_and_reversal** — 0.0: The required sequence ran, but a read-only result-assembly exception lost transient Tab, Shift+Tab, Undo, and Redo checkpoints; therefore the criterion is unverified.
- **unicode_grapheme_backspace_delete** — 1.0: Inserted UNICODE-BACKSPACE:A🙂B and UNICODE-DELETE:AéB. Copy verified 🙂 as U+1F642 and é as U+0065 U+0301. One Backspace yielded ...:AB and one Undo restored the exact emoji line; one Delete yielded ...:AB and one Undo restored the exact decomposed line. Reload removed both markers.
- **unicode_grapheme_navigation_selection** — 1.0: Find selected A🙂éB exactly. One-step copies were A (41), 🙂 (1f642), and é (65,301). Reload removed UNICODE-NAV.
- **selection_real_mouse_word_line_range_keyboard** — 1.0: Measured real double-click copied Timeline and removed only it; one Undo restored it. Triple-click removed Customer impact while preserving Checkout requests, and one Undo restored both. Drag copied Checkout requests and produced the exact leading-space remainder; one Undo restored it. Keyboard DONE replacement was exact; reload restored seeded lines.
- **selection_autoscroll_exact_offscreen_range** — 0.0: The drag scrolled 158→1530 and copied a range containing ALPHA-0010 through ALPHA-0060, but the recorded start point was x=25 in the gutter while the rendered text began at x=79, so the required glyph-boundary hit was not established.
- **clipboard_external_multiline_internal_exact** — 0.0: Multiline paste and whole-document copy worked, but the required second-line setup acted on EXTERNAL-C: clipboard was EXTERNAL-C and the cut tail was [EXTERNAL-A, EXTERNAL-B, ""] instead of [EXTERNAL-A, "", EXTERNAL-C].
- **undo_separate_locations_and_redo_invalidation** — 1.0: LOCATION-ONE, LOCATION-TWO, and LOCATION-THREE each appeared once. Undo removed THREE then TWO completely; two Redos restored both completely. REDO-CLEAR-ORIGINAL was fully undone and never resurrected after REDO-CLEAR-NEW.
- **undo_paste_cut_atomic** — 1.0: Pre-paste ended with an empty final line. Exact PASTE-A/B/C paste, one Undo, and one Redo all matched. Selecting PASTE-B copied exactly that text; cut produced [PASTE-A, "", PASTE-C], and one Undo/Redo reversed it atomically.
- **undo_typed_selection_replacement_atomic** — 1.0: Keyboard selection copied Timeline exactly. Sequential REPLACE-ATOMIC replacement was exact; one Undo restored Timeline completely and one Redo restored the full replacement.
- **find_replace_exact_counts_and_offsets** — 1.0: NEXT had 3 matches and cycled 18→19→20→18 with exact copied NEXT. FOLLOWUP changed only line 18. ALPHA-00 had 99 matches; Replace All made 99 INCIDENT-MARKER-00 replacements, preserving ALPHA-0100, ALPHA-1200, and one OMEGA sentinel. Reload restored saved content.
- **keyboard_find_focus_and_cycle** — 1.0: Control+F focused the app Find input. Initial editor selection was absent; Enter/Enter/Shift+Enter selected lines 18, 19, 18, each exact NEXT. Escape returned editor focus and one copy read NEXT.
- **long_document_three_region_round_trip** — 1.0: TOP-ROUNDTRIP, MID-ROUNDTRIP at zero-based index 613, and TAIL-ROUNDTRIP were each typed once. One save advanced revision 2→3; reload preserved exactly those three changed lines and no others.
- **revision_history_preview_restore_undo_exact** — 1.0: REVISION-HISTORY-A and B were saved as revisions 4 and 5. Scoped revision-1 preview had 1,226 lines, original line 1, and no A/B. Restore matched preview and left server revision 5 unchanged; one Undo restored the exact pre-restore draft with both markers.
- **two_tab_chained_stale_save_conflicts** — 1.0: Both tabs opened at revision 5. Tab A saved revision 6. Stale B received HTTP 409 with visible conflict alert and retained TAB-B-STALE; reload/rebase saved revision 7. Stale A then received HTTP 409 with retained draft; server kept A-WINS and B-REBASED only.
- **multi_caret_full_typing_single_undo** — 1.0: Real Alt-click created exactly three carets after Timeline, impact, and items. Sequential MULTI produced TimelineMULTI, Customer impactMULTI, and Action itemsMULTI. One Undo removed all three and one Redo restored all three; reload preserved originals.
- **multi_caret_backspace_delete_sibling** — 1.0: Real Alt-click carets after each target yielded Timelin, Customer impac, and Action item with one Backspace; one Undo restored originals. Start carets yielded imeline, ouster? No: exact observed lines were imeline, ouster? Actually observed `imeline`, `ustomer impact`, `ction items`; one Undo restored originals.
- **manifest_documents_runtime_routes** — 1.0: Manifest documented npm start, SQLite /app/data/patchpad.db, list/load/save/history/historical routes. Live requests matched GET /api/documents, GET /api/documents/incident-alpha, GET revisions, GET revisions/1, and POST /api/documents/incident-alpha/save with documentId/baseRevision/content.
- **restart_seed_idempotence_and_saved_history** — 1.0: PATCHPAD-RESTART-PROOF saved exactly once at revision 9, with one document and nine complete historical contents. Two exact helper restarts reported readiness; fresh pages matched metadata, revision 9, full content, all history revisions/timestamps/contents, and visible marker once.
- **direct_api_save_rejection_nonmutation_matrix** — 1.0: Observed POST /api/documents/incident-alpha/save body keys documentId/baseRevision/content. Legitimate save advanced 9→10 with API-CURRENT-WINS once. Stale, unknown-id, contradictory-id, missing/string/fractional baseRevision, missing/null content probes returned 409/404/400 and every post-probe state stayed byte-for-byte unchanged. Extra currentRevision returned 200 unchanged. Final revision remained 10; FORGED-STALE-OVERWRITE stayed zero.

#### polish

- **labelled_primary_controls** — 1.0: Visible controls include Save, Undo, Redo, Find Next, Replace Current, Replace All, and Revision History. Find and replacement inputs have accessible names and placeholders.
- **keyboard_focus_and_editor_entry** — 1.0: Real Tab/Shift+Tab reached the search inputs, toolbar controls, editor, and history controls. Escape from the custom editor moved focus to Find without changing document text. Focused controls showed a visible 3px teal outline.
- **history_and_feedback_readability** — 1.0: Revision numbers and timestamps are readable in the history panel. The visible role=status region says “Saved | No active search,” distinguishing normal feedback textually and semantically from failure feedback.

#### render

- **page_load_and_refresh** — 1.0: PatchPad loaded with the Northwind API Incident Report editor and visible content. GET /api/documents/incident-alpha returned 200 with the report data. Reload succeeded with no console errors or blank/server-error page.
- **basic_control_interaction** — 1.0: The visible Find control accepted “API”, remained editable and visible, and the editor stayed responsive. The field was cleared afterward.

#### visual

- **visual_typography** — 0.75: Editor surface uses a clear UI/document font pairing, consistent line height, aligned gutter, and readable controls. Report section labels share body styling and the preview text is relatively small, limiting typographic hierarchy.
- **visual_color_and_contrast** — 1.0: Editor and history/preview use a cohesive navy, blue-gray, white, and teal palette. Body text, controls, status, gutter, and preview remain legible with distinguishable accents.
- **visual_spacing_and_layout** — 0.75: Toolbar, editor gutter, and history rail are cleanly aligned with even card spacing. Normal scrolling leaves a large blank area beneath the shorter editor column, and the expanded preview is visually compressed.
- **visual_hierarchy_and_scanability** — 0.75: The header, toolbar, editor, Documents panel, and Revision History are easy to scan, with visible save feedback. Internal report sections are not strongly differentiated and the status line is subdued.
- **visual_overall_craft** — 0.75: The editor, Find/Replace toolbar, history cards, and preview share consistent borders, radii, typography, and palette. The compressed raw-text preview and unbalanced lower scroll area are minor polish issues.

### gemini-3.7-flash

Run: `run-4c06c380-e252-4a9c-ab96-4c8a1d6584f1`; [original trial](../../../run-outputs/patchpad-editor-v2/run-4c06c380-e252-4a9c-ab96-4c8a1d6584f1/patchpad-editor-v2__v7fkxVw/result.json).

#### constraints

- **same_origin_application_shell** — 1.0: All required document, CSS, JavaScript, and API requests were same-origin localhost requests. The incident report API returned 200 with the displayed report, the custom editor was visible, and there were no console errors.
- **self_contained_entry_and_reload** — 1.0: The root entry rendered the PatchPad report and a visible custom DIV-based editor surface. A full reload of http://localhost:3000/ returned the report and editor at document.readyState complete without external navigation or build/install steps.

#### functional

- **seed_document_integrity** — 0.0: The initial API content checks matched revision 1, 1,226 lines, and all required sentinels, but an exactly-one-document listing was not established before editing.
- **custom_editor_surface_real_input** — 1.0: Real mouse focus and keyboard typing produced CUSTOM-SURFACE-PROOF exactly once; full copied draft confirmed it, and reload removed it.
- **unsaved_edit_discard_on_reload** — 0.0: Reload discarded the suffix and preserved server content/revision, but the pre-reload dirty indicator was not captured explicitly.
- **noop_save_revision_invariant** — 1.0: Visible Save plus three Ctrl+S commands left revision 1, 159,334-byte content, and one history entry unchanged; UI showed Saved and “Document is unchanged.”
- **edit_save_reload_and_fresh_client** — 1.0: BASIC-SAVE-CHECK was absent initially, typed once with an Unsaved changes badge, saved as revision 2 with the exact line 1, and a cleared fresh client loaded identical content/revision.
- **keyboard_navigation_exact_coordinates** — 1.0: One-based labels were consistent: Home Ln1 Col1; four Downs Ln5 Col1; End Ln5 Col9; Down Ln6 Col9; Home/Left/Right Ln6 Col1/Ln5 Col9/Ln6 Col1; End/Up/Down Ln6 Col59/Ln5 Col9/Ln6 Col9; tail End Ln1226 Col63.
- **word_navigation_and_selection_shortcuts** — 1.0: NORTH WIND was appended as line 1227; Ctrl+Right reached Col7, Shift+Ctrl+Right copied exactly “NORTH ”, Ctrl+Left returned Col7, and Shift+Ctrl+Left copied exactly “WIND”; reload removed the line.
- **backspace_delete_exact_line_join** — 0.0: JOIN-LEFT/JOIN-RIGHT/JOIN-TAIL were created and Backspace joined them, but the required Undo-before-Delete step was not performed; Delete consequently acted on the wrong state.
- **tab_indentation_and_reversal** — 1.0: Tab changed Timeline to exactly two leading spaces plus Timeline; Shift+Tab restored Timeline; one Undo restored the indented line and one Redo restored Timeline; reload preserved Timeline.
- **unicode_grapheme_backspace_delete** — 0.0: The Find setup selected the pasted multiline payload rather than the emoji/decomposed graphemes, so the required exact Backspace/Delete operations were not established.
- **unicode_grapheme_navigation_selection** — 0.0: Find Next left focus on the button and copied the full UNICODE-NAV line instead of A🙂éB; the required grapheme movement sequence therefore was not performed.
- **selection_real_mouse_word_line_range_keyboard** — 0.0: Double- and triple-click checks passed, but the real drag copied “eckout requests were” rather than exactly “Checkout requests”; the conjunctive criterion fails.
- **selection_autoscroll_exact_offscreen_range** — 0.0: ALPHA-0010 was at the viewport edge, the drag caused no scroll, and both legs copied the full document rather than a selection beginning at ALPHA-0010 and including ALPHA-0060.
- **clipboard_external_multiline_internal_exact** — 1.0: The exact external payload preserved newline/tab; paste matched the expected document, copied EXTERNAL-B<TAB>CELL exactly, cut produced suffix [EXTERNAL-A, "", EXTERNAL-C], Undo restored the paste, Redo restored the empty middle line, and reload removed all markers.
- **undo_separate_locations_and_redo_invalidation** — 0.0: Only LOCATION-ONE and LOCATION-TWO were typed; tail navigation failed before LOCATION-THREE and the required Undo/Redo sequence, so the criterion was not completed.
- **undo_paste_cut_atomic** — 1.0: Pre-paste ended with an empty final line; one paste produced PASTE-A/B/C, one Undo restored the exact pre-paste document, one Redo restored it, cut copied PASTE-B exactly, and cut Undo/Redo produced [PASTE-A, "", PASTE-C].
- **undo_typed_selection_replacement_atomic** — 1.0: Keyboard selection copied exactly Timeline; sequential REPLACE-ATOMIC typing replaced it, one Undo returned exactly Timeline, one Redo returned the full replacement, and reload restored Timeline.
- **find_replace_exact_counts_and_offsets** — 0.0: NEXT cycling visited 20→18→19 correctly, but Replace Current changed line 19 instead of line 18 and the required Replace All result was not established.
- **keyboard_find_focus_and_cycle** — 1.0: Ctrl+F focused the app Find input; with no initial editor selection, Enter selected lines 19 then 20, Shift+Enter returned line 19, Escape returned editor focus, and one Copy yielded exactly NEXT.
- **long_document_three_region_round_trip** — 0.0: Only TOP-ROUNDTRIP was typed; the visible Find setup for the middle region failed before MID/TAIL edits and the required single save.
- **revision_history_preview_restore_undo_exact** — 0.0: A and B saved as revisions 3 and 4; history/timestamps and scoped revision-1 preview were valid, and Restore was dirty with the server unchanged, but one Undo did not restore the full pre-restore draft containing both markers.
- **two_tab_chained_stale_save_conflicts** — 1.0: Tab A saved TAB-A-WINS at R5; stale Tab B retained TAB-B-STALE and showed a conflict with server unchanged; rebased B saved TAB-B-REBASED at R6; stale A then conflicted and server remained exactly A+B at R6.
- **multi_caret_full_typing_single_undo** — 0.0: Alt modifier clicks did not create three carets in the required setup; MULTI was inserted only on Action items, so the exact three-line typing/Undo/Redo requirement failed.
- **multi_caret_backspace_delete_sibling** — 0.0: Alt clicks created three carets and Backspace correctly yielded Timelin/Customer impac/Action item, but the start clicks placed carets at Col3 and Delete yielded Tieline/Cutomer impact/Acion items instead of the required strings.
- **manifest_documents_runtime_routes** — 1.0: Manifest documented npm start, /app/patchpad.db, GET document, GET revisions, GET historical revision, and POST save. Live requests matched GET /api/documents/incident-alpha, GET /revisions, GET /revisions/1, and POST /save.
- **restart_seed_idempotence_and_saved_history** — 1.0: PATCHPAD-RESTART-PROOF was absent at revision 7, saved once as revision 8 with one new history entry, and both exact restart runs reported readiness, one document, identical full content/metadata/history, marker count one, and visible line 1227.
- **direct_api_save_rejection_nonmutation_matrix** — 1.0: Observed contract was POST /api/documents/incident-alpha/save with URL and body identities plus documentId/baseRevision/content. Legitimate R8→R9 succeeded; stale=409, unknown=404, mismatch=400, missing/string/fractional base=400, missing/null content=400, and extra currentRevision=200 unchanged. Every probe preserved exact protected content/history; API-CURRENT-WINS remained once, forged marker zero, revision 9.

#### polish

- **labelled_primary_controls** — 1.0: The toolbar visibly exposes Save, Undo, Redo, Find & Replace, and History. The open find/replace bar provides understandable Next, Replace, and Replace All controls, plus visible input placeholders.
- **keyboard_focus_and_editor_entry** — 1.0: Keyboard traversal reached the toolbar, History, both inputs, Replace controls, and the editor. Escape moved editor focus to the Find input without changing the document; Tab and Shift+Tab continued successfully with visible focus outlines/borders.
- **history_and_feedback_readability** — 0.0: Revision numbers and Saved/Document loaded feedback are readable, but the history timestamps render beyond the 1280px viewport while overflow is hidden, so timestamps cannot be read.

#### render

- **page_load_and_refresh** — 1.0: PatchPad loaded with the Northwind API Incident Report and visible editor. GET /api/documents/incident-alpha returned 200 with the report data. Reload returned HTTP 200 with content intact and no browser or console errors.
- **basic_control_interaction** — 1.0: Find accepted and retained the editable search text “latency” while showing matches; the field was cleared and the panel closed afterward.

#### visual

- **visual_typography** — 0.75: The desktop editor uses crisp monospace body text with aligned line numbers and a compact, differentiated UI type system. Plain-text section headings and clipped history labels/actions prevent a fully polished score.
- **visual_color_and_contrast** — 0.75: The editor, Find/Replace bar, preview banner and history use a cohesive dark palette with distinct cyan, green and orange accents. Most text is legible, though muted match counts, toggles and sidebar metadata are somewhat low-contrast.
- **visual_spacing_and_layout** — 0.25: The main header, toolbar, gutter and status bar align cleanly, and Find/Replace fits in one row. The history/preview sidebar is visibly cut off at the 1280px edge, clipping its close control, timestamps and repeated Restore actions.
- **visual_hierarchy_and_scanability** — 0.75: Branding, report title, save state, toolbar actions, preview state and revision cards have clear prominence. Document section headings share body styling, and clipped history actions slightly weaken secondary-surface scanning.
- **visual_overall_craft** — 0.5: The editor has a coherent dark IDE-like language with deliberate buttons, status treatments, line gutter and revision cards. The repeated right-edge clipping in history makes the secondary surface feel unfinished despite the otherwise consistent craft.

### claude-haiku-4-5

Run: `run-8b405014-ee0d-43bd-99dc-57b2083661ff`; [original trial](../../../run-outputs/patchpad-editor-v2/run-8b405014-ee0d-43bd-99dc-57b2083661ff/patchpad-editor-v2__h3enX98/result.json).

#### constraints

- **same_origin_application_shell** — 1.0: Root, style.css, editor.js, incident data, and history all loaded from http://localhost:3000; no external runtime assets or APIs were observed. The only error was a non-required same-origin favicon 404.
- **self_contained_entry_and_reload** — 1.0: The root rendered the titled report with a visible custom div-based editor surface, and after a full reload it returned through http://localhost:3000/ with the same editor and report data. No build, install, or external navigation was needed.

#### functional

- **seed_document_integrity** — 0.0: Initial API/UI showed revision 1 and 1,226 lines, but line 24 used ALPHA-1 instead of ALPHA-0001 and line 623 used ALPHA-600 instead of ALPHA-0600.
- **custom_editor_surface_real_input** — 0.0: A real click hit the visible editor, but typing CUSTOM-SURFACE-PROOF produced doubled characters with zero exact occurrences; a hidden TEXTAREA.editor-input was also present.
- **unsaved_edit_discard_on_reload** — 0.0: The draft became dirty and reload preserved the server baseline, but the typed suffix became doubled (`UUNNSSAAVVEEDD...`) rather than the exact required suffix.
- **noop_save_revision_invariant** — 0.0: The clean Save attempt produced the native alert “No unsaved changes”; the required three shortcut readback and complete invariant could not be captured after modal interruption.
- **edit_save_reload_and_fresh_client** — 0.0: Save advanced revision 1 to 2 and fresh load matched the server, but line 1 contained doubled text and spaces rather than the exact BASIC-SAVE-CHECK suffix.
- **keyboard_navigation_exact_coordinates** — 0.0: Display was one-based, but four ArrowDown presses reached Line 9, Column 1 instead of logical line 5 offset 0; the final-line mouse placement also reset to Line 1, Column 1.
- **word_navigation_and_selection_shortcuts** — 0.0: Control+End stayed on line 1, Enter created extra lines, NORTH WIND was not created as the final line, and both copied strings were empty.
- **backspace_delete_exact_line_join** — 0.0: The required JOIN paste inserted no JOIN markers; Backspace/Delete consequently operated on the tail instead. Reload confirmed all JOIN markers absent.
- **tab_indentation_and_reversal** — 0.0: Tab produced `\t\tTimeline` and Shift+Tab restored Timeline, but one Undo left Timeline instead of the recorded indentation; Redo also left Timeline.
- **unicode_grapheme_backspace_delete** — 0.0: The exact clipboard payload including 🙂 and decomposed é was read back, but the paste inserted neither required Unicode line, so the grapheme deletion setup was not established.
- **unicode_grapheme_navigation_selection** — 0.0: The exact UNICODE-NAV:A🙂éB sample was never inserted and no required grapheme Arrow/Shift+Arrow clipboard sequence was established.
- **selection_real_mouse_word_line_range_keyboard** — 0.0: Double-click Backspace changed Timeline to `Tiline`; triple-click changed Customer impact to `Custom impact`; the drag produced `Checkout requestwere...`; keyboard typing produced doubled DONE on line 19 rather than the required line 18.
- **selection_autoscroll_exact_offscreen_range** — 0.0: The required ALPHA-0010 setup had zero matches; the seed instead contained the unpadded form, so neither required selection/autoscroll leg was established.
- **clipboard_external_multiline_internal_exact** — 0.0: External clipboard readback exactly preserved EXTERNAL-A, the tabbed EXTERNAL-B line, and EXTERNAL-C, but one Enter created two empty lines and the single paste inserted no EXTERNAL text.
- **undo_separate_locations_and_redo_invalidation** — 0.0: The required ALPHA-0600 navigation target was absent; the document contained ALPHA-600, so the three-location marker sequence was not established.
- **undo_paste_cut_atomic** — 0.0: The one Enter precondition produced two empty final lines instead of one, and the exact PASTE-A/B/C paste inserted nothing; the cut/undo sequence was therefore not established.
- **undo_typed_selection_replacement_atomic** — 0.0: Selection replacement produced a doubled, cross-line result (`RREEPPLLAACCEE--AATTOOMMIICCTC - Alert...`); one Undo restored Timeline, but one Redo did not restore the replacement.
- **find_replace_exact_counts_and_offsets** — 0.0: NEXT cycled 19→20→18→19, but each real copy returned stale PASTE-A/B/C. Replace Current was unavailable, ALPHA-00 had zero matches instead of 99, and Replace All made no replacements.
- **keyboard_find_focus_and_cycle** — 0.0: Ctrl+F correctly focused the app Find input and navigation reached lines 18→19→20→19, but after Escape and one Copy the clipboard remained PASTE-A/B/C rather than NEXT.
- **long_document_three_region_round_trip** — 0.0: The three edits saved as revision 3 and preserved line count/other lines, but each required suffix was doubled and exact suffix counts were zero.
- **revision_history_preview_restore_undo_exact** — 0.0: Two saves created revisions 4 and 5 and history had five timestamped entries, but markers were doubled; clicking Revision 1 raised `this.previewRevision is not a function`, leaving the preview unavailable.
- **two_tab_chained_stale_save_conflicts** — 0.0: Stale saves returned 409 with visible Conflict feedback and server revisions stayed protected, but TAB-A-WINS, TAB-B-REBASED, and TAB-A-STALE-SECOND were all doubled, so exact marker requirements failed.
- **multi_caret_full_typing_single_undo** — 0.0: Alt-click did not add carets; Control-click established three. Five sequential keys produced `TimelineMMUULLTTII` and `Customer impactIITTLLUUMM`, not MULTI, and Redo did not restore the full insertion.
- **multi_caret_backspace_delete_sibling** — 0.0: Control-click established three carets, but Backspace produced `Timeli` and joined/shifted sibling text; Delete produced `meline`, `utomer impact`, and `cton items`, not the required one-character deletions.
- **manifest_documents_runtime_routes** — 0.0: APP_MANIFEST.md documented npm start, /app/patchpad.db, document/save/history/revision routes, but the criterion’s separate live preview/save request observation was lost when Playwright transport closed.
- **restart_seed_idempotence_and_saved_history** — 0.0: The first required restart helper reported readiness, but fresh-page API/editor comparisons, the marker save, and the second restart could not be completed after Playwright transport failure.
- **direct_api_save_rejection_nonmutation_matrix** — 0.0: The required final in-page save-contract discovery and rejection matrix were not executed after Playwright transport closed; no probe results were established.

#### polish

- **labelled_primary_controls** — 1.0: The gate passed: the page shows the named report and a 200 same-origin GET for /api/documents/incident-alpha supplied it. Toolbar and replacement controls are visible and understandable, with placeholders for both inputs and a visible Revision History.
- **keyboard_focus_and_editor_entry** — 0.0: Tab traversal reached the toolbar, both inputs, replacement buttons, and editor with visible focus indicators. Revision entries are non-focusable generic elements, and Escape from the keyboard-entered editor left focus in the editor instead of moving to Find.
- **history_and_feedback_readability** — 1.0: Revision numbers and timestamps are clearly readable. The visible “Saved” wording distinguishes normal feedback without relying on color alone.

#### render

- **page_load_and_refresh** — 1.0: PatchPad loaded with the Northwind API Incident Report, a readable line-numbered editing surface, and successful same-origin GET /api/documents/incident-alpha data containing the report. Reload returned the editor UI without a fatal error; only a non-fatal favicon 404 appeared.
- **basic_control_interaction** — 1.0: The visible Find control accepted “latency”, remained focused, editable, and visible. It was cleared afterward, and the editor remained responsive.

#### visual

- **visual_typography** — 1.0: Header, toolbar, document, gutter, and history use readable, consistent type with clear size/weight differences and a distinct monospace document face. No visible truncation or collisions.
- **visual_color_and_contrast** — 0.75: The white, soft-gray, blue, and green palette is cohesive and readable across the editor, status, Find/Replace row, and history. Line numbers, timestamps, and disabled controls are somewhat pale.
- **visual_spacing_and_layout** — 1.0: At 1280×800, the header, toolbar, gutter, scrolling document, status bar, and 250px history column form a stable arrangement with even margins and no overlap or page-wide overflow. The expanded Replace row remains contained.
- **visual_hierarchy_and_scanability** — 0.75: The report title, Saved status, primary actions, editor gutter, and Revision History are easy to find by scanning. Internal report sections rely mostly on blank lines and do not receive distinct heading styling.
- **visual_overall_craft** — 0.75: The editor and history surfaces share a restrained, coherent visual language with polished card states and integrated secondary controls. Some controls feel utilitarian/default, and the visible revision card did not produce a preview surface, so preview-specific craft was not inferred.

### gpt-5.4-mini

Run: `run-a7d98acc-c194-47ce-9e57-0da0b8f5104d`; [original trial](../../../run-outputs/patchpad-editor-v2/run-a7d98acc-c194-47ce-9e57-0da0b8f5104d/patchpad-editor-v2__jHMVuT8/result.json).

#### constraints

- **same_origin_application_shell** — 1.0: The root loaded at http://localhost:3000 with PatchPad and a visible incident editor. Required resources and the successful /api/bootstrap response all came from localhost; the response supplied the shown Northwind API Incident Report. No fatal runtime error blocked the shell; the only console error was a non-fatal same-origin favicon 404.
- **self_contained_entry_and_reload** — 1.0: The root rendered a usable custom DOM editor, and a full reload through / returned it with the report still visible. The surface contained 1,226 rendered editor lines and no textarea, contenteditable, canvas, SVG, or prohibited editor-library surface.

#### functional

- **seed_document_integrity** — 0.0: Required padded markers were absent: line 24 had ALPHA-1 and line 623 had ALPHA-600.
- **custom_editor_surface_real_input** — 0.0: Real edit was attempted, but transient evidence was lost at the unload dialog.
- **unsaved_edit_discard_on_reload** — 0.0: Dirty-state evidence was not preserved before reload.
- **noop_save_revision_invariant** — 1.0: Revision, content, and one-entry history remained unchanged after no-op Save and three Ctrl+S presses; UI reported no changes.
- **edit_save_reload_and_fresh_client** — 0.0: BASIC-SAVE-CHECK landed on line 2, not required line 1.
- **keyboard_navigation_exact_coordinates** — 0.0: A coordinate-query failure lost required intermediate checkpoint evidence.
- **word_navigation_and_selection_shortcuts** — 0.0: Shortcut and clipboard evidence was lost at the unload dialog.
- **backspace_delete_exact_line_join** — 0.0: Backspace/Undo passed, but Delete did nothing because focus remained on findNextButton.
- **tab_indentation_and_reversal** — 0.0: Visible Timeline click placed the caret on line 6; Tab/Shift+Tab did not indent line 5.
- **unicode_grapheme_backspace_delete** — 0.0: Find left focus on findNextButton; clipboard contained the full payload and grapheme deletion did not occur.
- **unicode_grapheme_navigation_selection** — 0.0: Find left focus on findNextButton; copied text was the full UNICODE-NAV line, not A🙂éB.
- **selection_real_mouse_word_line_range_keyboard** — 0.0: The drag copied Line 6, Column 13 rather than the requested text, and the DONE edit did not occur.
- **selection_autoscroll_exact_offscreen_range** — 0.0: Required ALPHA-0010 and ALPHA-0060 markers were absent; only unpadded markers existed.
- **clipboard_external_multiline_internal_exact** — 1.0: Exact multiline/tab paste, line copy, cut, Undo/Redo, Ctrl+A/C, and post-reload non-persistence all passed.
- **undo_separate_locations_and_redo_invalidation** — 0.0: The required ALPHA-0600 target was absent; line 623 contained unpadded ALPHA-600.
- **undo_paste_cut_atomic** — 1.0: Exact pre-paste, paste, single Undo/Redo, PASTE-B cut, and single Undo/Redo snapshots all matched.
- **undo_typed_selection_replacement_atomic** — 0.0: Timeline was selected and Redo returned REPLACE-ATOMIC, but the Undo checkpoint was recorded as a DOM node rather than exact text.
- **find_replace_exact_counts_and_offsets** — 0.0: Find reported three NEXT matches, but Find Next left focus on findNextButton and clipboard remained CLIP-SENTINEL.
- **keyboard_find_focus_and_cycle** — 1.0: Ctrl+F focused the app input; selections cycled line 18→19→20→19, Escape restored editor focus, and Ctrl+C copied NEXT.
- **long_document_three_region_round_trip** — 1.0: TOP, MID, and TAIL suffixes were appended once, saved as revision 3, and full content matched the baseline everywhere else after reload.
- **revision_history_preview_restore_undo_exact** — 0.0: History A saved at revision 4, but B save timed out/unestablished; Restore/Undo did not return the pre-restore draft.
- **two_tab_chained_stale_save_conflicts** — 1.0: A saved at revision 5; stale B and stale A saves both returned HTTP 409 with visible conflicts and unchanged authoritative content; B rebased at revision 6.
- **multi_caret_full_typing_single_undo** — 0.0: Alt and Control modifier-clicks each produced only one caret on line 6, not three requested carets.
- **multi_caret_backspace_delete_sibling** — 0.0: Fresh Alt and Control modifier-clicks again produced one caret only, so required deletions could not be performed.
- **manifest_documents_runtime_routes** — 1.0: Manifest matched observed routes: GET bootstrap/document/revisions/historical revision and POST document save; npm start and SQLite path also matched.
- **restart_seed_idempotence_and_saved_history** — 0.0: The two restart calls completed server-side, but the orchestration failed before preserving readiness and full post-restart comparisons; proof is unverified.
- **direct_api_save_rejection_nonmutation_matrix** — 0.0: Contract was POST /api/documents/incident-alpha/save with documentId, baseRevision, and content. All probes preserved revision 9/content/history, but string baseRevision returned HTTP 200 no-op instead of required non-2xx.

#### polish

- **labelled_primary_controls** — 1.0: The gate passed: the root rendered the Northwind report and a successful same-origin /api/bootstrap response supplied its active document. Save, Undo, Redo, Find Next, Replace Current, Replace All, and Revision history are visibly named; Find and Replace have visible labels/placeholders.
- **keyboard_focus_and_editor_entry** — 1.0: Real Tab and Shift+Tab traversal reached the toolbar, both inputs, editor, and history controls with visible focus outlines. Tab entered the custom editor; Escape moved focus to Find without changing document text, and subsequent traversal worked.
- **history_and_feedback_readability** — 1.0: History shows readable revision numbers and timestamps. Text such as “Revision 9 is saved,” “Saved · Revision 9,” and “Report loaded and ready” clearly communicates normal status without relying on color.

#### render

- **page_load_and_refresh** — 1.0: Root loaded a substantive PatchPad editor showing “Northwind API Incident Report” and readable incident content. Same-origin GET /api/bootstrap returned 200 with the active report data. Reload returned PatchPad with the editor and content intact; no fatal browser error occurred.
- **basic_control_interaction** — 1.0: The visible Find textbox accepted “latency”, retained the value while the page stayed responsive, and was then cleared successfully.

#### visual

- **visual_typography** — 1.0: Clear type system with distinct sans-serif UI text, tracked labels, and readable monospaced editor/history text; alignment is consistent with no collisions.
- **visual_color_and_contrast** — 0.75: Cohesive dark palette with strong cyan, blue, and green accents; secondary text is slightly muted and the gray history buttons feel less integrated.
- **visual_spacing_and_layout** — 1.0: Consistent gutters and padding create a stable header, toolbar, editor/history split, preview, and status arrangement; scrolling stays contained without overlaps.
- **visual_hierarchy_and_scanability** — 0.75: Brand, report selection, Save action, editor, history, preview, and feedback are easy to locate; plain-text report sections and history content have somewhat flat emphasis.
- **visual_overall_craft** — 0.75: Polished, coherent dark editor across primary and secondary surfaces, with minor inconsistency from native-looking gray history controls and limited section differentiation.
