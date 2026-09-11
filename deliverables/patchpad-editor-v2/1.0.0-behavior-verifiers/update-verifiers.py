from pathlib import Path
import json
import shutil
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
baseline = OUT / 'before-behavior-verifiers.zip'
if not baseline.exists():
    shutil.copyfile(OUT.parent / '1.0.0-no-comments/patchpad-editor-v2.zip', baseline)
with zipfile.ZipFile(baseline) as archive:
    old_bytes = archive.read('patchpad-editor-v2/tests/functional/judge.toml')
    old_prompt = archive.read('patchpad-editor-v2/tests/functional/prompt.md')
old = tomllib.loads(old_bytes.decode('utf-8'))
replacements = {
    'keyboard_navigation_exact_coordinates': """Use the real mouse to place the caret in the first logical line and press Home to establish its start. Observe whether the displayed line and column counters each start at zero or one, and use those same bases consistently throughout. The line ordinals below identify document content, not mandatory display labels; character offsets count characters before the caret, starting at zero. Use real key presses only for the following sequence. Four ArrowDown presses must reach the fifth logical line at offset 0. End must reach the end of Timeline at offset 8. ArrowDown must reach the sixth logical line at offset 8; Home must reach its offset 0; ArrowLeft must cross the newline to the end of Timeline; ArrowRight must return to the start of the sixth logical line. Press End on the sixth logical line and require its actual end, then ArrowUp must clamp to the end of the shorter Timeline line and ArrowDown must restore the intended position at the end of the sixth logical line. Finally use the real mouse to place the caret inside the final logical line, press End, and require the caret after its complete tail-sentinel text. At every checkpoint, require the visible caret and displayed cursor position, normalized using the established bases, to agree with the exact content-derived position. Record the observed labels and normalized positions. A consistent zero-based or one-based display is acceptable; incorrect movement, inconsistent counters, document changes, or loss of editor focus fails.""",
    'tab_indentation_and_reversal': """Use the real mouse and keyboard to focus seeded logical line 5, whose exact value is Timeline, and press Home. Press Tab exactly once. Require focus to remain in the custom editor and line 5 to gain a nonempty leading indentation made only of spaces or tabs, with Timeline itself byte-for-byte unchanged. Accept the app's indentation width without imposing a fixed character count. Record that exact indented line. Press Shift+Tab exactly once and require line 5 to return exactly to Timeline. Press Undo exactly once and require the exact recorded indented line to return; press Redo exactly once and require exactly Timeline again. Adjacent lines must remain unchanged throughout. Reload without saving and require line 5 to remain Timeline. Browser focus traversal, insertion away from the line start, non-whitespace content changes, or multiple Tab/Shift+Tab presses fail.""",
    'selection_autoscroll_exact_offscreen_range': """Navigate visibly to ALPHA-0010 and establish that ALPHA-0060 is below the visible document region. Identify the scrollable region actually used to view the document: it may be the editor, an ancestor container, or the page. Starting at the beginning of the rendered ALPHA-0010 line, use real mouse down and drag to the lower scrolling boundary of that visible region, keeping the horizontal pointer position within the document text area. Keep the primary button held at or just beyond that boundary, within the browser viewport, allowing up to 20 seconds for selection-driven scrolling until ALPHA-0060 enters the selected range; then release once near the right side of the text area. Require newly revealed document content and actual scrolling of the relevant region, and require the selected text, copied with Ctrl/Cmd+C, to begin in the ALPHA-0010 line and include ALPHA-0060 in document order. Do not require a particular element's scrollTop to change. Do not use synthetic events, set scroll positions directly, or use a separate wheel/scroll command to rescue the drag. Clear the selection, return to the beginning of ALPHA-0010 with ALPHA-0060 initially offscreen again, and verify editor focus and the starting position. Hold Shift, press ArrowDown exactly 50 times, then press Shift+End to include the target line. Require selection-driven scrolling to reveal the target and keep the caret visible, and require copied selected text to include both ALPHA-0010 and ALPHA-0060 in order. Scrolling the editor, an ancestor, or the page is acceptable in either leg when caused by the required selection interaction. A stationary visible document region or selection ending at the original visible edge fails. Do not release immediately after the drag move or infer failure from an unperformed gesture.""",
    'direct_api_save_rejection_nonmutation_matrix': """Observe the live app's save request to discover its actual route, method, document-identity locations and body shape. Use same-origin fetch calls matching that contract; do not invent a document-id URL segment or require a redundant body id. Record base content, revision R, and the exact revision list. Make one legitimate save at R that appends API-CURRENT-WINS and require success at R+1 with exactly one new revision. Protect that exact post-save state. Using the older R and baseline content, attempt FORGED-STALE-OVERWRITE and require HTTP 409. Test an unknown document id at the location or locations actually used by the request, such as its URL path, query or body; if the contract carries the id in multiple places, change all copies consistently for this unknown-id probe. Test a contradictory document-id pair only if the actual contract carries the id in more than one place, changing one copy while retaining the valid id in another. A body-only or URL-only identity does not require a URL/body mismatch probe. If the actual request carries no document id, record the observed contract and mark only these identity-location probes not applicable. Independently test missing base revision, string and fractional base revisions, missing content, and null content; all applicable rejection probes must return non-2xx. Build each malformed request from an otherwise valid request at the protected current revision R+1, changing only the field under test, so an unrelated stale revision cannot mask acceptance of invalid data. Finally send the protected content with the current R+1 base revision plus an extra forged currentRevision field; the server may reject it or ignore only that extra field, but it must not change content or create a revision. Re-read the real document and revision list after every probe and require exact equality with the protected post-save state. Record each probe's status and any identity probe's non-applicability with observed request evidence; other required probes cannot be skipped. At the end require API-CURRENT-WINS exactly once, FORGED-STALE-OVERWRITE zero times, revision still R+1, and the revision list exactly equal to the protected post-save list. Any rejected request that mutates content or creates a revision is an immediate failure. Do not restore, resave, or otherwise repair the document after any unexpected mutation.""",
}
new_bytes = old_bytes
changes = []
for criterion in old['criterion']:
    identifier = criterion['id']
    if identifier not in replacements:
        continue
    before = criterion['description']
    marker = ('This criterion is all-or-nothing and must be the final criterion evaluated. '
              if identifier == 'direct_api_save_rejection_nonmutation_matrix'
              else 'This criterion is all-or-nothing. ')
    prefix = before.split(marker, 1)[0] + marker
    after = prefix + replacements[identifier] + '\n'
    newline = '\r\n' if b'\r\n' in old_bytes else '\n'
    old_fragment = before.replace('\n', newline).encode('utf-8')
    new_fragment = after.replace('\n', newline).encode('utf-8')
    assert new_bytes.count(old_fragment) == 1, identifier
    new_bytes = new_bytes.replace(old_fragment, new_fragment)
    changes.append(dict(id=identifier, weight=criterion['weight'], before=before.strip(), after=after.strip()))
assert len(changes) == 4
(TASK / 'tests/functional/judge.toml').write_bytes(new_bytes)
prompt = old_prompt.decode('utf-8')
newline = '\r\n' if '\r\n' in prompt else '\n'
addition = """- Treat criterion line/column examples as logical text positions. Establish the
  app's displayed zero-based or one-based line and column conventions once,
  then normalize consistently when comparing the displayed position with the
  required caret movement. This also applies to word-navigation examples;
  exact selected text and all required keyboard actions remain mandatory.
- An explicitly conditional API identity probe is not applicable only when
  the observed request contract lacks the identity location or redundant pair
  that probe requires. Record the request evidence and reason. This exception
  does not waive other sub-checks or allow skipping an applicable probe.

""".replace('\n', newline)
anchor = 'Important grading rules:' + newline + newline
assert prompt.count(anchor) == 1
prompt = prompt.replace(anchor, anchor + addition)
old_discovery = """1. Observe or infer the document id and current revision from the app's own API
   calls or UI state.""".replace('\n', newline)
new_discovery = """1. Observe the app's own successful save request and document reads to establish
   the actual save route, method, body shape, document-identity locations and
   current revision. Preserve unrelated valid request fields during probes.""".replace('\n', newline)
assert prompt.count(old_discovery) == 1
prompt = prompt.replace(old_discovery, new_discovery)
(TASK / 'tests/functional/prompt.md').write_bytes(prompt.encode('utf-8'))
(OUT / 'verifier-changes.json').write_text(json.dumps(changes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
report = ['# PatchPad verifier wording: before and after', '',
          'Four Functional descriptions changed. Criterion IDs, types and weights are preserved.',
          'The shared Functional prompt now explains coordinate normalization and explicitly conditional identity probes.', '']
for item in changes:
    report += ['## ' + item['id'], '', 'Weight: ' + str(item['weight']), '',
               '### Earlier', '', item['before'], '', '### Now', '', item['after'], '']
(OUT / 'VERIFIER_BEFORE_AFTER.md').write_text('\n'.join(report), encoding='utf-8')
print('Updated four criterion descriptions and shared measurement guidance; exact comparison saved.')
