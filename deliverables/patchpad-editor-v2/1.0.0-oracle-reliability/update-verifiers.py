from pathlib import Path
import json
import re
import shutil
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
BASELINE = OUT / 'before-oracle-reliability.zip'
if not BASELINE.exists():
    shutil.copyfile(OUT.parent / '1.0.0-docketlight-weights/patchpad-editor-v2.zip', BASELINE)
with zipfile.ZipFile(BASELINE) as archive:
    old_judge = archive.read('patchpad-editor-v2/tests/functional/judge.toml').decode('utf-8')
    old_prompt = archive.read('patchpad-editor-v2/tests/functional/prompt.md').decode('utf-8')
replacements = {
    'tab_indentation_and_reversal': """Feature metadata: feature=editing; sub_feature=tab_and_shift_tab_indentation; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Record each checkpoint as plain text before issuing the next editing command; do not assemble all results only after the full sequence.
1. Through the real mouse and keyboard, focus the seeded Timeline line and press Home. Verify the caret is at the start of that line, the editor has focus, and its exact text is Timeline. Record the adjacent lines.
2. Press Tab once. Read and record the exact resulting line immediately. Require a nonempty leading prefix made only of spaces or tabs, followed by unchanged Timeline, with editor focus retained. Accept the app's indentation width.
3. Press Shift+Tab once. Read and record exactly Timeline immediately.
4. Press Undo once. Read and record the exact indented line from step 2 immediately.
5. Press Redo once. Read and record exactly Timeline immediately.
6. Require the adjacent lines unchanged at every checkpoint. Reload without saving and require Timeline unchanged in the saved report.
Browser focus traversal, a missing indentation, altered non-whitespace content, an incorrect reversal, or an additional editing command to repair a failed result fails. A judge measurement exception is handled by the prompt's invalid-attempt procedure; it is not evidence that the app performed the wrong edit.
""",
    'selection_autoscroll_exact_offscreen_range': """Feature metadata: feature=selection; sub_feature=offscreen_autoscroll; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Test both real mouse selection and real keyboard selection. The required outcome is a selection beginning at the start of the ALPHA-0010 logical line and reaching through ALPHA-0060 in document order while the visible document region scrolls.
1. Navigate visibly to ALPHA-0010, with ALPHA-0060 initially below the visible region. Identify the actual scroll region: editor, ancestor container or page. Measure the rendered start of the ALPHA-0010 text including padding and horizontal scroll. Prefer a point at that text start. A gutter is also acceptable if the app supports beginning a text selection there; verify its resulting anchor is the start of the requested logical line. Do not fail solely because a supported selection began in the gutter.
2. Press the primary mouse button once at that start and drag to the lower scrolling boundary, keeping the pointer horizontally over the document area. Hold at or just beyond the boundary, within the browser viewport, for up to 20 seconds until ALPHA-0060 is selected; release once. Do not substitute wheel scrolling, synthetic events or programmatic scroll changes.
3. Copy once from the focused editor and await the real clipboard update. Record the scroll change and selected text boundaries. Require newly revealed document content, actual selection-driven scrolling, a copied range starting with the full ALPHA-0010 line, and ALPHA-0060 included after it. A stationary viewport, a wrong anchor, a range ending at the initial visible edge, or merely copying the whole document fails.
4. Clear the selection and return to the start of ALPHA-0010 with ALPHA-0060 offscreen again. Confirm editor focus, the starting logical line, and the start-of-line caret before issuing the next keys. Hold Shift, press ArrowDown exactly 50 times, then Shift+End. Copy once and require the exact document slice from the start of ALPHA-0010 through the end of ALPHA-0060. Require selection-driven scrolling to reveal the target and keep the caret visible.
Record the mouse and keyboard evidence separately. Either leg may scroll the editor, an ancestor or the page. The complete document must remain unchanged. Perform both legs; success in one does not establish the other.
""",
    'clipboard_external_multiline_internal_exact': """Feature metadata: feature=clipboard; sub_feature=external_multiline_and_internal_cut; kind=graded; depends_on=seed_document_integrity. This criterion is all-or-nothing. Record each exact text and clipboard checkpoint before the next mutation.
1. Put the exact external payload "EXTERNAL-A\\nEXTERNAL-B\\tCELL\\nEXTERNAL-C" on the real browser clipboard, using actual newline and tab characters. With the editor focused at the document end, insert one newline and press Ctrl/Cmd+V once. Await insertion and require exactly those three final logical lines, preserving the tab in EXTERNAL-B. Record the full current document in test variables.
2. Establish the caret in the second inserted line, EXTERNAL-B followed by a tab and CELL. If the caret is at the end of EXTERNAL-C, press ArrowUp once and verify the target line; otherwise navigate visibly to that exact second line. Confirm editor focus. Press Home then Shift+End and copy once. Await the clipboard update and record exactly "EXTERNAL-B\\tCELL". Do not proceed with Cut if the clipboard instead contains EXTERNAL-C, the entire payload or an earlier value. Inspect the setup and focus first; an actual incorrect selection after correctly targeted actions fails.
3. Press Ctrl/Cmd+X once and await the edit. Record the final three lines and require exactly ["EXTERNAL-A", "", "EXTERNAL-C"], with the earlier document unchanged.
4. Press Undo once. Read and record restoration of the complete document from step 1, including the exact tabbed second line.
5. Confirm editor focus without clicking text or changing the selection. Press Ctrl/Cmd+A once, then Ctrl/Cmd+C once. Await a new clipboard result and compare it byte-for-byte with the complete current document, from its original first line through EXTERNAL-C. An old second-line clipboard value is not evidence of a new Copy.
6. Reload without saving and require the saved baseline with no EXTERNAL markers.
Use real keyboard clipboard commands. Direct text injection, calling application handlers, partial cut/Undo, or missing whole-document selection fails. Preserve the required single Cut and single Undo; do not repair an incorrect result with additional edits.
""",
}
parsed = tomllib.loads(old_judge)
newline = '\r\n' if '\r\n' in old_judge else '\n'
new_judge = old_judge
changes = []
for criterion in parsed['criterion']:
    if criterion['id'] not in replacements:
        continue
    before = criterion['description']
    after = replacements[criterion['id']]
    escaped_after = after.replace('\\', '\\\\')
    match = re.search(r'id = "' + re.escape(criterion['id']) + r'"[\s\S]*?description = """\r?\n([\s\S]*?)"""', new_judge)
    assert match, criterion['id']
    old_fragment = match.group(1)
    new_fragment = escaped_after.replace('\n', newline)
    assert new_judge.count(old_fragment) == 1, criterion['id']
    new_judge = new_judge.replace(old_fragment, new_fragment)
    changes.append({'id':criterion['id'], 'before':before, 'after':after})
(TASK / 'tests/functional/judge.toml').write_bytes(new_judge.encode('utf-8'))
prompt = old_prompt.replace('\r\n', '\n')
start = prompt.index('- Before a real mouse gesture,')
end = prompt.index('- After a rejected save response,', start)
prompt = prompt[:start] + """- Before a real mouse gesture, measure the visible text boundaries including
  padding and horizontal scroll, then verify the intended logical line and
  caret/selection anchor. Do not assume fixed pixels, row heights or IDs.
  A supported gutter gesture is acceptable for the offscreen-selection
  criterion when it establishes the required start-of-line anchor.
- Capture one transient checkpoint before the next mutation. Return plain
  strings, numbers and booleans from browser observations, not DOM nodes,
  locators or unresolved promises. Serialize a small read-only sample first.
  Keep full document snapshots inside test variables; report exact relevant
  lines and comparison results rather than dumping all 1,226 lines.
- Treat setup, the tested action, and evidence capture as separate steps.
  Before typing, cutting, deleting or using Undo/Redo, establish the required
  target and focus. If setup hit the wrong line or left focus on a toolbar
  button, correct setup before performing the tested action. Do not interpret
  a keyboard command sent to a button as a test of editor behavior.
- If a read-only observation fails, fix that observation before any further
  mutation. A measurement error or tool disconnection is not an observed app
  defect. Preserve evidence outside any multi-action tool call so its final
  result-assembly failure cannot discard earlier checkpoints.
- Invalid-attempt procedure: if a demonstrated judge setup mistake, output
  serialization error or tool failure has already made an UNSAVED-only
  criterion unverified, record the failed attempt and reason. At most once
  per criterion, discard that attempt through the app's normal reload/discard
  flow, verify the server content, revision and history still equal the
  pre-attempt baseline, and rerun the entire criterion from clean UI setup.
  Do not use this recovery for an observed app failure, a correctly targeted
  wrong result, a saved write, a rejected API probe or a restart sequence.
  Never change the database or source. All required actions and exact counts
  must hold within the complete rerun; do not combine fragments into a pass.
  If valid evidence is still unavailable, score no and report the judge
  limitation. Correctly observed app failures remain failures.
""" + prompt[end:]
prompt = prompt.replace("""- A failed read-only query is a measurement failure, not an observed app defect.
  Correct its selector/query while the same state remains available, before
  moving on. Do not repeat a mutation, repair app state or award an assumed pass.
  If evidence has already been lost, explicitly report the unverified check and
  judge-procedure limitation rather than inventing a negative app observation.
""", '')
prompt = prompt.replace("""- If any named sub-step cannot be performed through its required interaction
  path, score the entire criterion as failed instead of finding an alternate
  route to the same final state.
""", """- If the app cannot perform a required sub-step through its required interaction
  path, fail the criterion. Only demonstrated judge errors qualify for the
  bounded invalid-attempt procedure; untested behavior never earns credit.
""")
prompt = prompt.replace('  Do not click document text, issue another Find Next or assume button focus is\n  editor focus.', '  After restoring editor focus, verify the selection still matches the target.\n  Do not click document text, issue another Find Next or assume button focus is\n  editor focus.')
prompt = prompt.replace('Important grading rules:\n\n', """Important grading rules:

- Before editing, capture the initial document listing and seed evidence.
  Capture the dirty status before reload in the unsaved-discard check.
  When the app uses browser alerts, confirms or beforeunload dialogs, observe
  their message and dismiss/accept the intended action through the browser.
  Register dialog handling before the action; a modal is not an app crash.
  Never place required edit evidence after a reload that may show a dialog.

""")
prompt = prompt.replace('- Measure mouse positions against the requested visible glyphs, not the gutter\n  or the left edge of a full-width line container.', '- For exact-word drags and multi-caret placement, measure the requested visible\n  glyphs, not the gutter or the left edge of a full-width line container.')
(TASK / 'tests/functional/prompt.md').write_bytes(prompt.replace('\n', newline).encode('utf-8'))
(OUT / 'verifier-changes.json').write_text(json.dumps(changes, indent=2) + '\n', encoding='utf-8')
report = ['# Oracle reliability changes', '', 'All IDs, weights, verdict types and required editing operations are preserved.', '']
for change in changes:
    report += ['## ' + change['id'], '', '### Before', '', change['before'], '### After', '', change['after']]
(OUT / 'VERIFIER_BEFORE_AFTER.md').write_text('\n'.join(report), encoding='utf-8')
print('Updated three criterion procedures and common evidence handling.')
