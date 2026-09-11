from pathlib import Path
import json
import re
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
with zipfile.ZipFile(OUT / 'before-docketlight-procedures.zip') as archive:
    original = archive.read('patchpad-editor-v2/tests/functional/judge.toml').decode('utf-8')
    prompt = archive.read('patchpad-editor-v2/tests/functional/prompt.md').decode('utf-8')
descriptions = {
    'tab_indentation_and_reversal': '''Feature metadata: feature=editing; sub_feature=tab_and_shift_tab_indentation; kind=graded; depends_on=seed_document_integrity.
Setup: open the current saved report and use ordinary visible navigation, Find or a real mouse click to focus the seeded Timeline line. Collapse any selection and use Home to place the caret at its start. Confirm the line is exactly Timeline and record the unchanged adjacent lines. The route used to reach this state is not graded.
Graded observations, all required:
1. Press Tab once. Require editor focus to remain and the line to gain a nonempty prefix of spaces or tabs followed by unchanged Timeline. Accept the app's indentation width. Read and record the exact indented line before continuing.
2. Press Shift+Tab once and record exactly Timeline. Press Undo once and record the exact indentation from observation 1. Press Redo once and record exactly Timeline again. Capture each result before the next command.
3. The adjacent lines remain unchanged throughout. Reload without saving and require the saved report to retain Timeline with no indentation.
Judge the observed text, focus and reversals. Extra editing commands to repair an incorrect result fail. Handle a demonstrated judge measurement/setup error with the prompt's bounded invalid-attempt procedure; never infer a pass from missing evidence.
''',
    'selection_autoscroll_exact_offscreen_range': '''Feature metadata: feature=selection; sub_feature=offscreen_autoscroll; kind=graded; depends_on=seed_document_integrity.
Setup: use ordinary visible navigation or Find to bring ALPHA-0010 into view with ALPHA-0060 initially below the visible region. Record the document's exact lines from the start of ALPHA-0010 through the end of ALPHA-0060. Identify the actual scroll region: editor, ancestor or page. Establish the start of the ALPHA-0010 line as the selection anchor. Use its rendered text start or a supported gutter gesture; the app's layout and setup route are not graded.
Graded observations, all required:
1. From that anchor, hold the primary mouse button and drag to the lower boundary of the visible document region, keeping the pointer horizontally over the document area. Hold there for up to 20 seconds while the region scrolls until ALPHA-0060 is selected, then release once. Copy once from the focused editor. Require actual selection-driven scrolling with newly revealed content and a copied range beginning with the full ALPHA-0010 line and including ALPHA-0060 afterward. The editor, an ancestor or the page may scroll. Synthetic events, separate wheel scrolling, programmatic scroll changes, a stationary viewport, a wrong anchor or a whole-document copy fail this observation.
2. As setup for the keyboard leg, clear the selection and return to the same start-of-line anchor with ALPHA-0060 offscreen again. Confirm focus and the caret before acting. Hold Shift, press ArrowDown exactly 50 times, then Shift+End. Copy once. Require exactly the recorded document slice through the end of ALPHA-0060, selection-driven scrolling and a visible final caret.
3. The full document remains unchanged. Record mouse and keyboard results separately; both legs must work. Do not reject a successful selection solely because the supported starting point was in a gutter or because the app uses a different scroll container.
''',
    'clipboard_external_multiline_internal_exact': '''Feature metadata: feature=clipboard; sub_feature=external_multiline_and_internal_cut; kind=graded; depends_on=seed_document_integrity.
Setup: record the saved baseline. Through ordinary visible navigation or Find, focus the editor at the end of the final logical line and insert one newline. Put the external payload EXTERNAL-A, EXTERNAL-B followed by a tab and CELL, and EXTERNAL-C on the real browser clipboard as three lines with actual newline/tab characters. Verify this payload is ready and the editor has focus. Setup navigation is not graded.
Graded observations, all required:
1. Press Ctrl/Cmd+V once and await insertion. Require exactly the three final lines ["EXTERNAL-A", "EXTERNAL-B\\tCELL", "EXTERNAL-C"] with no other change. Store the complete resulting document in test variables.
2. Navigate visibly to the second inserted line, EXTERNAL-B followed by a tab and CELL. An ArrowUp from the end of EXTERNAL-C or Find is valid setup. Confirm the target line and editor focus before selecting it with Home, Shift+End. Copy once and await exactly "EXTERNAL-B\\tCELL" on the clipboard. If focus or the target was not established, correct setup first; do not Cut EXTERNAL-C or stale clipboard content.
3. With that selection established, Cut once. Await and record the three final lines exactly ["EXTERNAL-A", "", "EXTERNAL-C"], with all preceding text unchanged. Undo once and require the entire document from observation 1 restored, including the tabbed second line.
4. Confirm editor focus, then use Ctrl/Cmd+A once and Ctrl/Cmd+C once. Await a new clipboard result and require byte-for-byte equality with the complete current document, from its original first line through EXTERNAL-C.
5. Reload without saving and require the saved baseline with no EXTERNAL markers.
Each mutation must be observed before the next. Use real keyboard clipboard commands. Direct text injection, application handlers, an incorrect Cut/Undo result, or incomplete whole-document selection fails. Preserve the single Cut and single Undo; do not repair an app failure with additional edits.
''',
}
old = tomllib.loads(original)
newline = '\r\n' if '\r\n' in original else '\n'
updated = original
changes = []
for criterion in old['criterion']:
    if criterion['id'] not in descriptions:
        continue
    after = descriptions[criterion['id']]
    match = re.search(r'id = "'+re.escape(criterion['id'])+r'"[\s\S]*?description = """\r?\n([\s\S]*?)"""',updated)
    assert match
    updated = updated[:match.start(1)] + after.replace('\\','\\\\').replace('\n',newline) + updated[match.end(1):]
    changes.append({'id':criterion['id'],'before':criterion['description'],'after':after})
(TASK / 'tests/functional/judge.toml').write_bytes(updated.encode('utf-8'))
guidance = '''For criteria with an explicit Setup line and numbered graded observations,
follow the Docketlight separation: actually reach the named setup state, then
grade every numbered observation. Setup navigation is flexible and its
intermediate clicks or focus corrections are not separate scored behavior.
Use the app's ordinary visible UI, keyboard and clipboard setup; do not inject
editor text/state, call handlers or use API writes to bypass editor behavior.
The graded actions keep their prescribed interaction paths and exact counts.
A setup state the app cannot provide is a failure; an awkward navigation route
is not proof of that failure. Stop after two unsuccessful setup attempts at
the same control, record the blocker and continue the remaining criteria.

'''.replace('\n',newline)
anchor='Important grading rules:'+newline+newline
assert prompt.count(anchor)==1
(TASK / 'tests/functional/prompt.md').write_bytes(prompt.replace(anchor,anchor+guidance).encode('utf-8'))
(OUT / 'verifier-changes.json').write_text(json.dumps(changes,indent=2)+'\n',encoding='utf-8')
report=['# Docketlight-style setup and observations','','Only the three failed Oracle criteria are reformatted. All weights and outcome checks remain.','']
for change in changes:
    report += ['## '+change['id'],'','### Earlier','',change['before'],'### Now','',change['after']]
(OUT / 'VERIFIER_BEFORE_AFTER.md').write_text('\n'.join(report),encoding='utf-8')
print('Updated three failed criteria with flexible setup and required numbered observations.')
