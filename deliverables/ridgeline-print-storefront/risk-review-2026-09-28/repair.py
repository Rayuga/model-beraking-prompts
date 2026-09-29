"""Apply the bounded Ridgeline review; do not edit Colderwater or shared tools."""
from pathlib import Path
import hashlib
import json
import re
import tomllib

ROOT = Path.cwd()
TASK = ROOT / 'projects/ridgeline-print-storefront'
OUT = Path(__file__).resolve().parent
before = {p.relative_to(TASK).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
          for p in TASK.rglob('*') if p.is_file()}
(OUT / 'before.json').write_text(json.dumps(before, indent=2))

def write(path, text):
    path.write_text(text, encoding='utf-8', newline='\n')

entry = TASK / 'tests/test.sh'
text = entry.read_text()
template = (ROOT / 'projects/webdev-task-template/tests/test.sh').read_text()
text = text[:text.index('validate_suite() {')] + template[template.index('run_suite() {'):]
write(entry, text)

context = TASK / 'tests/app_context.md'
text = context.read_text().split('## Evaluator failures')[0]
text += '''## Evidence failures

Score observed application behavior independently. Retry a transient browser-tool operation once when safe; do not repeat a completed purchase or the single process restart. If an observation remains unavailable, record exactly what could not be observed and distinguish an evaluator failure from an observed application failure. Never invent a pass. Return the supported verdicts for the remaining criteria and keep their observed credit. There is no special reasoning prefix that invalidates other results; RewardKit and the standard scorer handle the returned outcomes. A native dialog, alternate route or ordinary application refusal is not an evaluator failure.
'''
write(context, text)

for dimension in ['functional', 'polish', 'visual']:
    path = TASK / f'tests/scored/{dimension}/prompt.md'
    text = path.read_text().replace('shared incomplete-evaluation rules', 'shared evidence-failure guidance')
    text = text.replace('shared evaluator-incomplete rule', 'shared evidence-failure guidance')
    text = text.replace('evaluator-incomplete, not a fabricated application failure', 'an unavailable observation, not proof of an application durability defect')
    text = text.replace('shared evaluator-failure rule', 'shared evidence-failure guidance')
    if dimension == 'functional':
        text = text.replace('- Perform the criteria in their listed order', '- Perform the criteria in their listed order')
        needle = '## Actual requests and fresh attempts'
        text = text.replace(needle, '''## Browser work

Inspect each screen once per required state and reuse the recorded facts for independent outcomes. The three catalogue-display outcomes share one initial grid/detail tour. Do not repeat a purchase or a shared procedure merely because it supplies several verdicts. After discovering the live controls, batch related browser actions and product-data reads in browser_run_code_unsafe; still observe every specified intermediate result. Request snapshots when a screen changes or selectors are uncertain, rather than after each field edit. Negative request variants may run in one browser invocation, with each request and its fresh stock/receipt reads recorded separately. Only the explicitly concurrent-buying probe sends competing writes concurrently. No source inspection or extra probes are allowed by this batching guidance.

''' + needle)
    write(path, text)

path = TASK / 'tests/scored/polish/judge.toml'
text = path.read_text()
start = text.index('[[criterion]]\nid = "labelled_controls_and_focus"')
end = text.index('[[criterion]]\nid = "interaction_feedback"', start)
replacement = '''[[criterion]]
id = "ridgeline_controls_have_names"
name = "ridgeline_controls_have_names"
type = "binary"
weight = 0.35
description = """
Using the shared P02 control tour, each requested enabled control has a visible label or accessible name identifying its purpose. Native labels, icons with accessible names and labelled menu items are valid. Judge names only; keyboard reachability, visible focus and view transitions have separate outcomes. Do not require exact words or a separate button for every purpose.
"""

[[criterion]]
id = "ridgeline_controls_keyboard_reachable"
name = "ridgeline_controls_keyboard_reachable"
type = "binary"
weight = 0.30
description = """
Using actual keyboard events in P02, every requested enabled control is reachable, including controls inside menus. Tab, Shift+Tab and native/composite arrow-key navigation are valid. Disabled controls need not be tab stops. Judge reachability only, independently of label quality and visible focus styling. Operate containing menus as needed; do not submit an order. The separate view-navigation outcome owns opening and leaving shop views.
"""

[[criterion]]
id = "ridgeline_keyboard_focus_is_visible"
name = "ridgeline_keyboard_focus_is_visible"
type = "binary"
weight = 0.35
description = """
During P02's actual keyboard traversal, the currently focused requested controls have a visible focus indicator. Native browser outlines are valid; do not require a specific colour or CSS implementation. Record the controls actually reached on each available surface and assess their visible focus independently. A control that cannot be reached belongs to the reachability outcome and does not erase focus credit for the controls reached. If no control can receive keyboard focus, this outcome has no positive evidence and fails. Do not infer visible styling from an accessible name or source code.
"""

'''
text = text[:start] + replacement + text[end:]
text = text.replace('Use a title search that matches a currently listed print, then clear it; the changed results are apparent. Add one currently available unit', 'Add one currently available unit')
text = text.replace('acknowledges these ordinary actions', 'acknowledges this successful addition')
text = text.replace('without repeating the labels/focus verdict', 'without repeating the names, reachability or focus verdicts')
write(path, text)
path = TASK / 'tests/scored/polish/prompt.md'
text = path.read_text()
text = text.replace('{criteria}', '''## P02: shared control tour

Perform this tour once for the names, keyboard-reachability and visible-focus outcomes. At desktop width inspect search, size/paper/sort controls, print-opening and return controls, basket and theme; available size/quantity/add controls; basket quantity/removal and checkout navigation; delivery fields, the enabled order-submission control and reference lookup. Pointer setup may open each surface and prepare one available unplaced unit, including filling a valid delivery address without submitting it. Use actual key events to traverse each surface, recording names, reachability and the visible focus indicator separately. Native focus styling, accessible menus and composite arrow-key navigation are valid. A missing label or failed keyboard step is not a reason to abandon the other observations; use pointer setup to reach the next surface when needed. Do not use programmatic focus as evidence. Do not place or cancel an order. Use the known historical receipt for read-only lookup and return, and empty the unplaced basket afterward. The separate keyboard view-navigation flow remains a small actual navigation test.

{criteria}''')
write(path, text)

path = TASK / 'tests/scored/functional/judge.toml'
text = path.read_text()
data = tomllib.loads(text)
first = data['criterion'][0]
facts = first['description'].split('Expected variant facts below')[1]
start = text.index('[[criterion]]')
end = text.index('[[criterion]]', start + 1)
def row(id, weight, desc):
    return f'[[criterion]]\nid = "{id}"\nname = "{id}"\ntype = "binary"\nweight = {weight}\ndescription = """\n{desc}\n"""\n\n'
replacement = row('ridgeline_catalogue_cards_show_price_and_stock', '0.1',
    'During the one shared initial catalogue tour, the grid contains eight distinct supplied prints, each with its lowest regular offered price and availability visible before opening it. Allotment is sold out; Harbour Mouth, Kiln and Long Field are available. Compare the grid prices against the variant facts in the adjacent detail outcome. Judge the card summary only; detail content and photographs are separate.')
replacement += row('ridgeline_catalogue_offered_variant_details', '0.1',
    'During the same initial tour, inspect all offered variants across the eight details: thirteen exact SKU-size combinations with supplied paper, regular price, trade offer and current quantity, including zero for sold-out sizes. Kiln normally has six after the gate purchase. Judge variant data only, independently of card summaries, photographs, search, filters and sorting.\n\nExpected variant facts below' + facts.strip())
replacement += row('ridgeline_print_photographs_match_details', '0.1',
    'During that same initial tour, each of the eight print details displays its own supplied photograph larger than on its grid card. Compare rendered images with their corresponding supplied assets; do not read app source. Judge the image identity and larger detail presentation only, independently of prices and variant data. Do not prescribe dimensions, cropping style or layout.')
text = text[:start] + replacement + text[end:]
text = text.replace(' The detail view explains the trade offer before it applies.', '')
text = text.replace(' The applied trade price is clear in the product/basket view.', '')
text = text.replace('the two Night Ferry A2 lines/quantities', 'the Night Ferry A2 variant at quantity two')
write(path, text)

after = {p.relative_to(TASK).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
         for p in TASK.rglob('*') if p.is_file()}
(OUT / 'changes.json').write_text(json.dumps({p: {'before': before[p], 'after': v}
    for p, v in after.items() if before.get(p) != v}, indent=2))
assert all(before[p] == after[p] for p in before if p.startswith(('solution/', 'environment/')))
print('Changed', [p for p in after if before.get(p) != after[p]])
