"""Apply the reviewed Ridgeline repairs; keep original feature budgets."""
import hashlib
import json
import re
import tomllib
import zipfile
from decimal import Decimal
from pathlib import Path

ROOT = Path.cwd()
TASK = ROOT / 'projects/ridgeline-print-storefront'
OUT = Path(__file__).resolve().parent
BASE = ROOT / 'deliverables/ridgeline-print-storefront/second-cross-check-2026-09-27/ridgeline-print-storefront.zip'
assert hashlib.sha256(BASE.read_bytes()).hexdigest() == 'e9571f7ec27341ace6c955a81de5cc8fd2199df804ee54b7c90a009b18333f9b'
with zipfile.ZipFile(BASE) as z:
    baseline = {n.split('/', 1)[1]: z.read(n) for n in z.namelist() if not n.endswith('/')}

def write(rel, body):
    (TASK / rel).write_text(body, encoding='utf-8', newline='\n')

metadata = baseline['task.toml'].decode()
metadata = re.sub(r'difficulty_explanation = """.*?"""', 'difficulty_explanation = "Variant-specific trade pricing and delivery bands interact with shared stock, concurrent purchases, retried requests, stored receipts and cancellation across server restarts."', metadata, flags=re.S)
metadata = re.sub(r'^provenance = .*$', 'provenance = "Adapted from the supplied Ridgeline Print Storefront brief and catalogue."', metadata, flags=re.M)
metadata = metadata.replace('"browser-judge", "rewardkit"', '"print-shop", "transactional-stock"')
metadata = metadata.replace('category = "E-commerce & Checkout Flows"', 'category = "programming"')
write('task.toml', metadata)

groups = {
 'variant_stock_and_valid_basket_boundary': [
  ('ridgeline_sold_out_variants_not_addable', '.5', 'Observe an available Harbour A3 added successfully and the offered sold-out Harbour A2 and Allotment remaining visible but unavailable for addition. Do not grade excess quantities here.'),
  ('ridgeline_overstock_basket_keeps_last_valid_line', '.5', 'Observe the successful one-unit Slack A2 basket, then the two-unit attempt refused with availability exposed and the last valid quantity retained. Do not inherit the separate sold-out-variant result.'),
 ],
 'ridgeline_unplaced_basket_survives_full_reload': [
  ('ridgeline_unplaced_basket_survives_full_reload', '.5', 'Observe the two Night Ferry A2 lines/quantities and exact basket figures after a full reload. Visitor isolation is separate; inability to open an evaluator context is not a product reload failure.'),
  ('ridgeline_visitors_keep_independent_baskets', '.25', 'Observe initially clean context B, its own Long Field basket, and both contexts retaining their distinct contents after reload. Use the continuing original page and the supplied second-context recipe. Do not inherit pricing or reload criterion verdicts.'),
 ],
 'mixed_trade_prices_survive_order_lookup': [
  ('ridgeline_checkout_address_and_amount_review', '.5', 'Before commitment, the UI presents the entered address and all four correct amounts for the specified mixed basket. A single screen is valid. Judge the pre-order review, not later receipt/storage results.'),
  ('mixed_trade_prices_survive_order_lookup', '2', 'After the actual mixed UI purchase, freshly retrieve its own reference and verify exact address, combined lines, variant-specific charged prices and receipt figures, plus the corresponding stock differences. A missing pre-commit summary does not negate a correct stored transaction.'),
 ],
 'combined_quantities_and_invalid_checkout_are_atomic': [
  ('ridgeline_repeated_additions_merge_in_basket', '.4', 'Repeated UI additions of three and two Nine Windows A3 become one five-unit line with the correct trade price. Observe that UI state itself; server duplicate-entry handling is separate.'),
  ('ridgeline_combined_server_lines_receive_trade_price', '.6', 'The observed list-shaped request containing three plus two of the same variant produces one stored five-unit line with the specified trade figures and stock difference. A keyed representation uses combined five. Require this successful current operation; do not inherit the UI merge verdict.'),
  ('ridgeline_combined_overstock_refused', '.75', 'After a real successful order control, the fresh combined overstock attempt is refused without a new order, stock change or receipt mutation. For list-shaped requests, use repeated entries whose sum exceeds observed stock although each entry fits. Successful duplicate pricing is not a prerequisite verdict.'),
  ('ridgeline_invalid_checkout_quantities_refused', '.75', 'Following a real valid purchase control, each separate fresh zero, negative and fractional quantity request is refused atomically. Observe stock and unchanged control receipt after each. These are the finite invalid quantity classes of one quantity-validation behavior; do not inherit duplicate-line or unknown-variant verdicts.'),
  ('ridgeline_unknown_variant_refuses_entire_order', '.5', 'With the valid purchase control established, a fresh order containing one available real line and one nonexistent variant is refused as a whole without deducting the real line or changing the control receipt. Do not infer atomicity from an HTTP error alone.'),
 ],
 'checkout_retry_identity_and_new_purchase': [
  ('ridgeline_identical_checkout_returns_original_order', '1', 'Following the actual first successful Night Ferry A2 purchase, two identical replays return its exact reference and receipt without additional stock deduction. A retry failure does not determine the changed-payload or genuinely new purchase outcomes.'),
  ('ridgeline_used_attempt_rejects_changed_lines', '.75', 'The completed attempt identity with changed quantities is refused, preserving the original receipt and stock. Require the real initial successful order; exact retry success is not required.'),
  ('ridgeline_used_attempt_rejects_changed_address', '.75', 'The completed attempt identity with original lines but a different valid address is refused, preserving the original address, receipt and stock. Do not inherit the changed-lines verdict.'),
  ('ridgeline_new_checkout_can_repeat_same_basket', '.5', 'A deliberately new UI checkout with the original basket and address receives a distinct reference, its own correct receipt and exactly one new stock deduction. It is not a replay. Assess this separately from reused-identity refusal.'),
 ],
 'cancellation_is_terminal_and_restores_stock_once': [
  ('ridgeline_cancel_restores_exact_stock_and_keeps_receipt', '1', 'The newly placed Night Ferry A3 order can be cancelled normally: its exact quantities return to stock, status becomes cancelled, and all original charged figures/address remain retrievable. Repeated cancellation and dispatched-order protection are separate.'),
  ('ridgeline_repeated_cancel_does_not_restore_twice', '.75', 'After observing an actual successful cancellation, both cancellation replays leave the same cancelled receipt and stock unchanged. Missing cancellation capability cannot earn absence-based credit.'),
  ('ridgeline_checkout_replay_does_not_revive_cancelled_order', '.75', 'After observing the actual successful cancellation, replaying its original checkout returns that same cancelled reference and receipt without stock deduction or resurrection. Do not inherit repeated-cancel results.'),
  ('ridgeline_dispatched_order_cannot_be_cancelled', '.5', 'With an actual cancellable-order operation as a positive control, attempt the observed cancellation operation for dispatched RP-100001. It refuses and preserves that historical receipt and Long Field A3 stock. Run this independent probe even if a prior replay failed.'),
 ],
 'restart_preserves_receipts_stock_and_retry_terminality': [
  ('ridgeline_order_snapshots_survive_process_restart', '1', 'After the single actual process restart, each successfully established pre-restart control retains its recorded reference, status, address, lines and charged figures. An unsuccessfully cancelled control may remain placed: compare its actual recorded status. No successful cancellation is required to prove placed-order durability.'),
  ('ridgeline_all_stock_and_catalogue_survive_restart', '1', 'After that actual restart, all thirteen variant quantities equal their complete observed pre-restart snapshot, with eight distinct prints/thirteen offered variants and the unchanged historical receipt. Do not inherit cancellation, new-receipt or replay verdicts.'),
  ('ridgeline_attempt_mappings_survive_restart', '1', 'The original successful checkout attempts replay after the actual restart to their own recorded reference/status without stock changes. Replay an actually successful pre-restart cancellation if one exists; its stock effect remains terminal. If cancellation was unavailable, use the two recorded placed controls to test persisted attempt identity without making cancellation a prerequisite. Judge persistence of the observed mappings, not whether cancellation worked before restart.'),
 ],
}

judge_path = 'tests/scored/functional/judge.toml'
old_text = baseline[judge_path].decode()
old_rows = tomllib.loads(old_text)['criterion']
header = old_text.split('[[criterion]]', 1)[0]
new_rows = []
protocols = []
mapping = []
for index, old in enumerate(old_rows, 1):
    split = groups.get(old['id'])
    if not split:
        new_rows.append(old)
        mapping.append({'original_id': old['id'], 'original_weight': str(old['weight']), 'outcomes': [{'id': old['id'], 'weight': str(old['weight'])}]})
        continue
    scenario = f'R{index:02}'
    description = old['description'].strip()
    if old['id'] == 'combined_quantities_and_invalid_checkout_are_atomic':
        description += '\n\nIndependent setup: the one-unit order in leg 1 is the shared successful capability control. A failed UI merge must not prevent leg 2 from sending its own observed fresh server request for three plus two. If leg 2 is refused, continue the refusal probes using observed current stock S: for the overstock probe choose two positive whole-number entries whose individual quantities fit S but whose sum exceeds S (or combined S+1 for a keyed representation). Do not assume fourteen or manufacture a successful duplicate order. Invalid-quantity and unknown-variant requests use otherwise valid fresh attempt data and the successful leg-1 control. Read actual stock before/after each probe. After an unexpected bad success, stop further mutations in that outcome, record it, then attempt the other outcomes only if their own stated valid control remains available.'
    if old['id'] == 'cancellation_is_terminal_and_restores_stock_once':
        description = description.replace('Cancel that placed order through its normal control', 'Reach the placed order cancellation control with actual keyboard navigation and activate it by keyboard, including any normal confirmation. Native keys and accessible menus are valid; no particular dialog is required. Cancel that placed order through this normal control')
    if old['id'] == 'restart_preserves_receipts_stock_and_retry_terminality':
        description = description.replace('Stock returns to S.', 'Record the actual post-cancellation status and stock; if cancellation is missing or fails, keep this control placed and continue without requiring a cancellation verdict.')
        description = description.replace('Stock is S minus one.', 'Record the actual resulting stock; normally it is S minus one.')
        description = description.replace('The first is still cancelled, the second still placed;', 'Each has its recorded pre-restart status (normally first cancelled, second placed);')
        description = description.replace('Kiln stock is still S minus one.', 'Kiln stock equals the observed pre-restart quantity.')
        description = description.replace('Replay the first cancellation: no extra stock is restored.', 'If the first cancellation actually succeeded before restart, replay it: no extra stock is restored. Otherwise do not make a new cancellation after restart a condition for durability.')
        description = description.replace('Pass only with the actual process restart and all durable controls.', 'The actual process restart is a shared observation, with separate outcomes for receipt snapshots, complete stock/catalogue state and persisted attempts. A tool failure is evaluator-incomplete, not a fabricated application failure.')
    protocols.append(f'### {scenario} — {old["id"]}\n\n{description}\n')
    outcomes = []
    for name, weight, meaning in split:
        new_rows.append({'id': name, 'name': name, 'type': 'binary', 'weight': float(weight), 'description': f'{scenario}: {meaning} Execute the shared {scenario} procedure once and assign this outcome from its own observations, without inheriting another outcome\'s verdict.'})
        outcomes.append({'id': name, 'weight': weight})
    assert sum(Decimal(x['weight']) for x in outcomes) == Decimal(str(old['weight']))
    mapping.append({'original_id': old['id'], 'original_weight': str(old['weight']), 'scenario': scenario, 'outcomes': outcomes})

def encode_row(row):
    return '\n'.join(['[[criterion]]', f'id = "{row["id"]}"', f'name = "{row["name"]}"', f'type = "{row["type"]}"', f'weight = {row["weight"]}', 'description = """', row['description'].strip(), '"""', ''])

assert sum(Decimal(str(r['weight'])) for r in new_rows) == Decimal('35')
assert len({r['id'] for r in new_rows}) == len(new_rows)
write(judge_path, header + '\n'.join(encode_row(r) for r in new_rows))
prompt = baseline['tests/scored/functional/prompt.md'].decode()
prompt = prompt.replace('- Every numbered leg is required.', '- Complete each shared procedure once, at its first listed outcome, and reuse the recorded observations for its siblings. Each outcome owns only its stated behavior; a sibling failure must not erase observed correct behavior. Every numbered leg is a required observation for the outcome that owns it, not an all-siblings pass condition.')
prompt = prompt.replace('After two failed attempts to perform the same app action, fail that criterion with the observed reason and continue.', 'After two failed attempts to perform the same app action due to an observed product failure, fail only its affected outcome with the reason and continue. A broken evaluator tool is governed by the shared incomplete-evaluation rules.')
prompt = prompt.replace('If the restart tool fails, report that evidence and fail the persistence criterion; do not claim a restart occurred.', 'If the restart tool fails, follow the shared evaluator-incomplete rule; do not claim a restart or a measured product durability failure.')
prompt = prompt.replace('Only the final persistence criterion calls the verifier MCP tool restart_app, exactly once. It first creates its own placed and cancelled controls,', 'Only shared procedure R25 calls the verifier MCP tool restart_app, exactly once for all three persistence outcomes. Never restart again for a sibling outcome. It first creates its own successful purchase controls, records the cancellation state actually reached,')
prompt = prompt.replace('{criteria}', '## Shared procedures\n\nThese replace repeated execution of the original flows. Keep each original stock allocation and perform the procedures in the order their outcomes first appear below. Ordinary failed outcomes do not cancel independent later observations. No extra process restart is added.\n\n' + '\n'.join(protocols) + '\n## Scored outcomes\n\n{criteria}')
write('tests/scored/functional/prompt.md', prompt)

context = baseline['tests/app_context.md'].decode() + '''
## Evaluator failures

Observed missing or broken application behavior earns the applicable failed outcome. An evaluator transport failure, unavailable browser context API, exhausted judge budget, or failed restart tool is not proof of an application defect. Retry a transient tool operation once when safe. If it still prevents the required observation, report a failed/raw-minimum transport value with reasoning beginning EVALUATION_INCOMPLETE: and describe the missing evaluator evidence. The harness rejects that incomplete suite as ungraded; never manufacture partial product credit. This prefix is reserved for actual evaluator failures, never an app message, an ordinary refused request, or a product action that does not work. A legitimate native dialog or alternate route is not a tool failure.
'''
write('tests/app_context.md', context)
for rel in ['tests/scored/polish/prompt.md', 'tests/scored/visual/prompt.md']:
    p = baseline[rel].decode()
    p += '\nApply the shared evaluator-failure rule when a tool failure prevents observation. An unavailable product surface itself remains an ordinary product failure.\n'
    write(rel, p)

polish = baseline['tests/scored/polish/judge.toml'].decode()
old = tomllib.loads(polish)['criterion']
for row in old:
    if row['id'] == 'labelled_controls_and_focus':
        row['description'] = '''At an ordinary desktop viewport, inspect search, size/paper/sort controls, print-opening and return controls, basket, theme, available size/quantity/add controls, basket quantity/removal and checkout navigation, delivery fields, order submission, and reference lookup. Each purpose has a visible label or accessible name. Use actual keyboard events to reach these controls when enabled and confirm visible focus; native focus styling, menus and composite arrow-key navigation are valid. Pointer setup may prepare one available unplaced unit and open each surface. Do not place or cancel an order just to inspect focus; reaching the enabled submit control is sufficient. Use the known historical receipt to return to the shop without requiring cancellation there. Disabled/sold-out controls need not be focusable. This criterion owns labels, reachability and visible focus; the separate navigation outcome observes opening and leaving views. No exact words, focus order or app-documented native key is required. Leave the unplaced basket empty afterward.'''
theme = next(r for r in old if r['id'] == 'theme_and_navigation')
parts = theme['description'].strip().split('\n\n')
new_polish = [r for r in old if r['id'] != 'theme_and_navigation'] + [
 {'id':'ridgeline_light_dark_switch_changes_theme','name':'ridgeline_light_dark_switch_changes_theme','type':'binary','weight':.5,'description':parts[0] + ' Missing keyboard navigation does not determine this verdict.'},
 {'id':'ridgeline_keyboard_views_have_usable_return','name':'ridgeline_keyboard_views_have_usable_return','type':'binary','weight':.5,'description':'\n\n'.join(parts[1:]) + '\nTheme switching does not determine this navigation verdict.'},
]
write('tests/scored/polish/judge.toml', polish.split('[[criterion]]')[0] + '\n'.join(encode_row(r) for r in new_polish))

shell = baseline['tests/test.sh'].decode()
cold = (ROOT / 'projects/colderwater-playground-devtools/tests/test.sh').read_text()
validator = cold.split('validate_suite() {', 1)[1].split('\nrm -f "$LOG_DIR/evaluation-incomplete.json"', 1)[0]
shell = shell[:shell.index('run_suite() {')] + 'validate_suite() {' + validator + '\nrm -f "$LOG_DIR/evaluation-incomplete.json"\n' + shell[shell.index('rm -rf "$LOG_DIR/scored"'):]
write('tests/test.sh', shell)

mapping_report = {'functional_count':len(new_rows), 'original_count':len(old_rows), 'original_total':'35', 'total':'35', 'polish_count':len(new_polish), 'polish_total':'4', 'mapping':mapping, 'baseline_sha256':hashlib.sha256(BASE.read_bytes()).hexdigest()}
(OUT / 'outcome_map.json').write_text(json.dumps(mapping_report, indent=2)+'\n', encoding='utf-8')
changed = [rel for rel, data in baseline.items() if (TASK / rel).read_bytes() != data]
assert not any(rel.startswith('solution/') for rel in changed)
(OUT / 'changed_files.json').write_text(json.dumps({'changed':changed, 'golden_unchanged':True}, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'functional_count':len(new_rows),'polish_count':len(new_polish),'functional_weight':35,'changed':changed},indent=2))
