# Current verifier review — PatchPad 2.0.5

Reviewed the merged 2.0.4 instructions, all four judge configurations and prompts,
all 35 criteria, golden server/editor, seed, installer and lifecycle/runner.
The release preserves every instruction and every criterion, including its
weight and expected values. Parsed judge configurations are identical to the
merged baseline; only their release-marker comments changed.

## Instruction / golden / local evidence mapping

Instruction filenames below refer to environment/assets/instructions/. Local
test names refer to the JSON/CJS evidence in this folder or the read-only
historical scripts rerun against the final source. A mapped local test is not
an LLM judge verdict. UI-quality ratings remain human/platform judgments.

| Dimension / criterion | Instruction coverage | Golden implementation / fresh local evidence |
| --- | --- | --- |
| Render: page_load_and_refresh | instruction.md root entry; interface.md readable report | loadDocument/render; baseline smoke, fresh-context and reload tests |
| Render: basic_control_interaction | persistence.md Find; interface.md controls | find input binding; smoke search/editability |
| Constraints: same_origin_application_shell | instruction.md and overview.md local resources | Express static/API; all recorded browser requests same-origin, offline container execution |
| Constraints: self_contained_entry_and_reload | instruction.md npm start/root; persistence.md reload | offline golden install, root/reload smoke |
| Functional: seed_document_integrity | overview.md supplied report, metadata and revision 1; seed JSON | ensureSeed; full 1,226-line expansion, one document, initial revision |
| Functional: custom_editor_surface_real_input | overview.md custom DOM/canvas/SVG and forbidden editors | custom DOM/model; exact CUSTOM-SURFACE-PROOF keyboard insertion, DOM surface inspection |
| Functional: unsaved_edit_discard_on_reload | persistence.md discard unsaved on reload | loadDocument; exact unsaved marker, unchanged complete server document/history |
| Functional: noop_save_revision_invariant | persistence.md unchanged save creates no revision | savedContent/dirty, server no-op branch; three Ctrl+S, unchanged content/history |
| Functional: edit_save_reload_and_fresh_client | persistence.md save/reload | saveDocument, SQLite; BASIC-SAVE-CHECK and new browser context |
| Functional: keyboard_navigation_exact_coordinates | editing.md arrows/Home/End/cursor position | moveCaret/preferredCol; full required coordinate sequence including last line |
| Functional: word_navigation_and_selection_shortcuts | editing.md both allowed conventions | moveCaretByWord; NORTH WIND motion/clipboard checks |
| Functional: backspace_delete_exact_line_join | editing.md Backspace/Delete/newlines | replaceRange; JOIN-LEFT/JOIN-RIGHT/JOIN-TAIL and single Undo |
| Functional: tab_indentation_and_reversal | editing.md Tab/Shift+Tab | insertText/outdentCurrentLine; exact indentation, Undo, Redo and focus |
| Functional: unicode_grapheme_backspace_delete | editing.md complete visible Unicode characters | Intl.Segmenter/previousPosition/nextPosition; emoji and decomposed accent deletion with one Undo |
| Functional: unicode_grapheme_navigation_selection | editing.md Unicode movement/selection | segment boundaries; exact clipboard A, emoji, decomposed accent |
| Functional: selection_real_mouse_word_line_range_keyboard | editing.md word/line/range/keyboard selection | onMouseDown, replaceRange; real double/triple clicks, Checkout requests drag, DONE replacement |
| Functional: selection_autoscroll_exact_offscreen_range | editing.md selection beyond visible report | drag timer/scrollCaretIntoView; real held-mouse autoscroll and 50 Shift+Down steps from ALPHA-0010 through ALPHA-0060 |
| Functional: clipboard_external_multiline_internal_exact | editing.md external/internal multiline/tabbed clipboard | clipboard handlers; exact three EXTERNAL lines, tab retained, cut/Undo, whole-document copy |
| Functional: undo_separate_locations_and_redo_invalidation | editing.md uninterrupted typing groups, movement boundary, new edit clears Redo | typingGroup/snapshots; full LOCATION markers and REDO-CLEAR markers |
| Functional: undo_paste_cut_atomic | editing.md clipboard/standard Undo | paste/cut snapshots; exact PASTE-A/B/C, single Undo and Redo |
| Functional: undo_typed_selection_replacement_atomic | editing.md selection replacement one action | grouped snapshots; keyboard-selected Timeline -> full REPLACE-ATOMIC, single Undo/Redo |
| Functional: find_replace_exact_counts_and_offsets | persistence.md Find count/cycle/one/all | recomputeMatches/findNext/replaceCurrent/replaceAll; 3 NEXT, 99 ALPHA-00 matches, exact unaffected text |
| Functional: keyboard_find_focus_and_cycle | editing.md keyboard Find and both directions | Ctrl+F, Enter/Shift+Enter, Find Escape; selected NEXT copied after focus return |
| Functional: long_document_three_region_round_trip | overview.md keep report intact; persistence.md changed save/reload | save/load; exact TOP/MID/TAIL suffixes and every other line unchanged |
| Functional: revision_history_preview_restore_undo_exact | persistence.md history/timestamps/preview/unsaved reversible restore | revision API and restoreRevision; both historical failure-path regression and complete preview/prior-Undo-history test |
| Functional: two_tab_chained_stale_save_conflicts | conflict-safety.md server revision protection and retained local draft | server 409 and client error handling; both chained conflicts with full document/history comparisons |
| Functional: multi_caret_full_typing_single_undo | editing.md modifier carets and uninterrupted typing group | extraCarets/groupedUndo; Alt and Control paths, full MULTI, single Undo/Redo |
| Functional: multi_caret_backspace_delete_sibling | editing.md deletion at every caret | deleteAcrossCarets; Alt and Control, exact three lines and unchanged neighbours after each deletion/Undo |
| Functional: manifest_documents_runtime_routes | overview.md main API routes/start/SQLite declaration | APP_MANIFEST; fresh live UI request trace mapped to all five document/history routes, missing-doc mutant rejected |
| Functional: restart_seed_idempotence_and_saved_history | overview.md normal restart keeps saved data and seeds only once | ensureSeed and sole app-lifecycle.sh; two process-group replacements, exact full current/history data, reseed mutant rejected |
| Functional: direct_api_save_rejection_nonmutation_matrix | conflict-safety.md integer revision/text/optional matching id/stale 409 | server save validation; positive current save, every listed rejection and unchanged history; additional false-like IDs rejected |
| Polish: labelled_primary_controls | interface.md discoverable labelled controls | rendered buttons and accessible Find/replacement names; browser selectors and focus traversal succeed |
| Polish: keyboard_focus_and_editor_entry | editing.md Escape-to-Find; interface.md visible focus | key handlers/CSS focus indicator; actual Tab/Shift+Tab and Escape test |
| Polish: editor_visual_hierarchy | interface.md readable report/status/history | render/CSS and fresh 1280x800 screenshot; qualitative 1–5 rating not asserted locally |
| Polish: history_and_feedback_readability | interface.md feedback; persistence.md timestamps | visible history/error/status; save/conflict and history regressions; qualitative readability not given a platform score |

## Ordering and independence review

- Seed checks precede changed saves. Custom-surface and unsaved-discard checks
  remain separate; control discoverability is still owned by Polish.
- BASIC-SAVE changes only the first line; subsequent fixed seed coordinates and
  selected Timeline/impact/items text remain intact. Unsaved editing tests reload
  after their checks. Long-document saves occur after fixed tail-coordinate tests.
- Revision, conflict, manifest, restart and final API checks use their current
  saved baseline rather than assuming a pristine revision count. The direct API
  rejection matrix stays last. There is exactly one scored restart criterion.
- RewardKit is invoked serially. Polish restores its own persisted probe through
  visible editing and save; Render/Constraints do not introduce saved changes.
- The manifest parser's disclosure, arbitrary database extension acceptance,
  flexible word boundaries, clipboard waits and clicked-command focus fixes remain.

## Remaining review risks, not claimed passes

- Workbook Quality Checks 9 and 10 still describe no-network agent and an
  allowlisted verifier. Current user instructions explicitly require public/public.
  That configuration is retained and verified in source and ZIP; a platform policy
  exception or updated rubric is needed if those workbook rows are applied literally.
  This also affects the offline-scoring interpretation of row 47.
- Several existing binary Functional criteria bundle related operations, and
  Render/Constraints both check basic reload. A stricter independence review can
  question those inherited choices. Coverage/weights were not removed or reduced.
- The seed includes a descriptive summary as well as id/title/author. The server
  exposes the latter metadata but not that summary. Whether the brief's general
  "metadata intact" wording requires exposing the seed's descriptive summary is
  not explicitly specified by a criterion; no unsupported pass is claimed for it.
- The direct API criterion assumes it can exercise a URL/body id mismatch while
  the brief does not mandate route layout. Current golden routes support every
  probe. A body-only save API could need a documented equivalent discovery path;
  this remains a fairness risk rather than silently dropping the rejection check.
- Local scripts exercise the actual behavior with golden-specific selectors;
  they do not prove an LLM will discover every control/coordinate correctly or
  finish all 35 criteria within its budget. No new paid Oracle was run.
- Actual model setup, repeat judge variance, adversarial score distributions,
  and macOS Meta-key behavior were not run. Both Alt and Control multi-carets
  were tested on Linux Chromium. Visual craft remains a judgment call.

The workbook has 53 Quality Checks and 58 Deterministic Check descriptions.
Its inventory is included without inventing executable checker results or a
53/53 platform verdict. The local 82-check packaging audit is a separate check set.
