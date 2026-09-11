# Running PatchPad locally

Golden app 2.0.16 is running at http://127.0.0.1:3033/ with no login.
Container: `patchpad-golden-preview-2016`, bound to the host loopback interface.
It uses a fresh copy of current golden source and task seed inside the existing
local dependency image `patchpad-preflight-tests:2.0.9`. This is not a fresh build
of the release Dockerfiles or a paid judge run. No task source was changed.

The preview remains running for inspection. Its SQLite database is inside the
container, not the repository or upload ZIP. Stopping and starting this container
preserves its existing app/database; initial solve runs only if package.json is
absent. Removing the preview container would remove this preview's saved edits.

Fresh browser tests on this running app all passed:

1. Dirty status before reload and exact saved content after unsaved discard.
2. Unicode deletion/navigation using Find Enter, then one Escape.
3. The same Unicode path using clicked Find Next.
4. Actual-focus-dependent Escape direction and selection preservation.
5. New editing invalidates Redo, including its button and shortcut.
6. Line-18 Replace Current and exact 99-match Replace All with sentinel/boundary
   preservation and visible input values.

See `current-failures-2.0.16.json`. No test saved its temporary markers; a fresh
page shows the original seeded report at revision 1. Screenshot is a real browser
capture, not a mockup. Host HTTP health check also returned `{"ok":true}`.

## Verifiers most vulnerable to judge execution errors

These are risks, not newly reproduced failures:

- `unicode_grapheme_navigation_selection`: the previous platform Oracle missed
  full-sample Find selection. Both current local input paths pass. Wrong focus,
  omitted Find navigation or stale clipboard evidence can still invalidate an
  otherwise correct test execution.
- `multi_caret_full_typing_single_undo` and
  `multi_caret_backspace_delete_sibling`: real held-modifier mouse gestures and
  precise caret coordinates matter; repeated Undo cannot rescue a failed check.
  The full 2.0.16 suite passed these, but they were not repeated in this preview.
- `clipboard_external_multiline_internal_exact` / `undo_paste_cut_atomic`:
  clipboard permission/timing, exact distinct payloads and empty logical lines
  must be observed correctly. The full 2.0.16 suite passed these.
- `revision_history_preview_restore_undo_exact`: scope preview text separately
  from the live draft, await Restore completion, then perform one Undo. The full
  2.0.16 suite passed this; it was not repeated on this preview database.
- `editor_visual_hierarchy` (Polish): its five-point visual rating is subjective.
  Functional correctness alone does not establish a full five-point verdict.

The earlier Find convention mismatch is fixed and tested against both golden
and unchanged Gemini. Virtualized-tail persistence is clarified and tested
through two actual restarts. Those are not outstanding known fairness defects.

No paid Oracle/model, fresh platform QC, or exact new-image build is claimed.
Current platform judge is Codex / gpt-5.6-luna / max. LLM execution accuracy and
timing remain unmeasured without a real judge run.

## Upload

Use the existing archive (unchanged by this preview):
`../2.0.16-verifier-fairness/patchpad-editor-v2.zip`.
SHA-256: `89783ebf40b4167223d6b5c7de75ffb08d866a3a190d0e12917568e6fb357399`.
Exactly one patchpad-editor-v2/ wrapper, 30 task files. No additional ZIP made.
