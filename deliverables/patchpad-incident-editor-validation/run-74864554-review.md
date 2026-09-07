# Run 74864554 diagnosis

The exported job completed both trials without infrastructure exceptions:
Oracle 0.8143; no-op 0. Render, Constraints and Polish each scored 1. Functional
scored 0.6905 (14.5/21 criterion weight). Of 33 criteria, 25 passed and 8 failed.
The newly added manifest and server-restart checks both passed.

## Evidence limits

The export includes reward-details.json and application source, but no full
judge action trajectory. Reasons alone cannot distinguish faulty coordinates,
modifier handling, clipboard timing, or missed steps from app bugs. The local
editor JavaScript hash matches the run artifact exactly. Diagnostic results
are in run-74864554-diagnostics.json; no production app/verifier was edited.

## Failed checks

| Criterion | Diagnosis |
| --- | --- |
| unicode_grapheme_backspace_delete | Judge stopped on Find focus. Locally clicking Find Next leaves BUTTON focused; editor keyboard events do not run. This does not establish a broken grapheme algorithm. |
| unicode_grapheme_navigation_selection | Same focus obstruction, not independent evidence of Unicode corruption. |
| undo_paste_cut_atomic | Not reproduced: exact three-line paste, one Undo/Redo, PASTE-B cut and one Undo/Redo all worked locally. Reason lacks exact incorrect outputs; judge trace is needed. |
| find_replace_exact_counts_and_offsets | Stale clipboard is reproducible when copying with Find Next still focused. Judge also says it did not perform the required Replace All input; no independent evidence here that Replace All is broken. |
| keyboard_find_focus_and_cycle | Not reproduced with documented Ctrl+F, Enter, Enter, Shift+Enter, Escape, Ctrl+C: clipboard was exactly NEXT. The reported stale PASTE-B needs action/timing evidence. |
| revision_history_preview_restore_undo_exact | Restore leaves BUTTON focused: Ctrl+Z does nothing there, but one visible Undo correctly restores the entire draft. The criterion allows Undo by intent; report does not identify which route the judge used. |
| multi_caret_full_typing_single_undo | Not reproduced: real keyboard.down(Alt/Control), mouse clicks, keyboard.up produced 3 carets with both modifiers; full MULTI appeared at all three locations and one Undo restored all. |
| multi_caret_backspace_delete_sibling | Judge stopped because it could not establish 3 carets. The setup failure was not reproduced; deletion substeps were not independently tested in this diagnostic. |

## Recommended next changes

1. Make the clicked Find Next command focus the editor, while preserving Find
   input focus for Enter/Shift+Enter cycling.
2. Focus the editor after Restore Draft; retain visible Undo as an equally valid
   route. The underlying restore snapshot worked in the local test.
3. Specify a clean paste insertion point and wait for asynchronous clipboard
   completion before asserting results.
4. Require actual held modifiers for multi-caret mouse actions, valid text
   coordinates, and exact observations. Do not weaken the expected results or
   assume a press-and-release Alt event holds Alt for a subsequent click.
5. Reproduce the remaining exact substeps before changing algorithms. Full
   Oracle still needs rerunning after fixes; this diagnosis is not a new score.
