import hashlib
import json
from pathlib import Path
import re
import tomllib
import zipfile

root = Path(__file__).resolve().parents[3]
out = Path(__file__).resolve().parent
task = root / 'projects/ridgeline-print-storefront'
baseline_path = out.parent / 'cross-check-2026-09-27/ridgeline-print-storefront.zip'
digest = lambda data: hashlib.sha256(data).hexdigest()
assert digest(baseline_path.read_bytes()) == '9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c'
with zipfile.ZipFile(baseline_path) as archive:
    baseline = {name.split('/', 1)[1]: archive.read(name) for name in archive.namelist() if not name.endswith('/')}
semantic_paths = ['instruction.md', 'task.toml', 'environment/assets/seed_data.json', 'tests/scoring.toml', 'tests/app_context.md']
semantic_paths += [str(p.relative_to(task)).replace('\\', '/') for p in (task / 'environment/instructions').glob('*.md')]
semantic_paths += [str(p.relative_to(task)).replace('\\', '/') for p in (task / 'tests').glob('*/*/judge.toml')]
semantic_paths += [str(p.relative_to(task)).replace('\\', '/') for p in (task / 'tests').glob('*/*/prompt.md')]
current = {name: (task / name).read_bytes() for name in semantic_paths}
hashes = {name: digest(data) for name, data in current.items()}
seed = json.loads(current['environment/assets/seed_data.json'])
variants = {(v['sku'], v['size']): v for v in seed['variants']}
assert len(variants) == 13 and len({v['sku'] for v in variants.values()}) == 8
dimensions = {Path(name).parent.name: tomllib.loads(data.decode()) for name, data in current.items() if name.endswith('/judge.toml')}
all_criteria = [c for data in dimensions.values() for c in data['criterion']]
assert len(all_criteria) == 37
assert len(dimensions['functional']['criterion']) == 25
assert sum(c['weight'] for c in dimensions['functional']['criterion']) == 35
for name, data in current.items():
    if name.endswith('/judge.toml'):
        old = tomllib.loads(baseline[name].decode())
        new = tomllib.loads(data.decode())
        signature = lambda doc: [(c['id'], c['type'], c['weight'], c.get('points')) for c in doc['criterion']]
        assert signature(old) == signature(new), name
        assert not {'model', 'weight', 'temperature', 'reasoning_effort'} & new['judge'].keys()
        assert new['judge']['judge'] == 'claude-code'
for name, data in current.items():
    if name.endswith('/prompt.md'):
        text = data.decode()
        assert all(s in text for s in ['http://localhost:3000', 'Playwright MCP', '{criteria}', '{app_context}', 'untrusted'])
        assert 'Do not inspect submitted source files' in text
public = '\n'.join(data.decode() for name, data in current.items() if name == 'instruction.md' or name.startswith('environment/instructions/'))
assert not any(c['id'] in public for c in all_criteria)
assert not re.search(r'\b(judge|rubric|criteria|reward|verifier|playwright)\b|TODO|FIXME|CHANGE_ME', public, re.I)

def paper_members(paper, require_stock=False):
    return sorted({v['title'] for v in variants.values() if v['stock_sheet'] == paper and (not require_stock or v['in_stock'] > 0)})
munken = 'Munken Pure Rough 240gsm'
pristine = 'Colorplan Pristine White 270gsm'
counterexample = {
    'faulty_rule': 'Filter the requested paper AND require in_stock > 0 before collecting print titles.',
    'old_munken_expected': paper_members(munken), 'faulty_munken_actual': paper_members(munken, True),
    'new_pristine_expected': paper_members(pristine), 'faulty_pristine_actual': paper_members(pristine, True),
}
assert counterexample['old_munken_expected'] == counterexample['faulty_munken_actual']
assert counterexample['new_pristine_expected'] != counterexample['faulty_pristine_actual']
(out / 'semantic-paper-counterexample.json').write_text(json.dumps(counterexample, indent=2) + '\n')

def calculate(lines):
    gross = saving = grams = 0
    for sku, size, qty in lines:
        item = variants[(sku, size)]
        gross += item['price_pence'] * qty
        unit = item['tier_price_pence'] if qty >= item['tier_qty'] else item['price_pence']
        saving += (item['price_pence'] - unit) * qty
        grams += (90 if size == 'A3' else 160) * qty
    postage = 175 if grams <= 100 else 320 if grams <= 500 else 495 if grams <= 2000 else 0
    return {'gross': gross, 'saving': saving, 'grams': grams, 'postage': postage, 'total': gross - saving + postage}

cases = [
 ('basket_reload', [('RP-108','A2',2)], (12900,0,320,320,13220)),
 ('trade_before', [('RP-108','A3',4),('RP-108','A2',1)], (23450,0,520,495,23945)),
 ('trade_after', [('RP-108','A3',5),('RP-108','A2',1)], (27700,3125,610,495,25070)),
 ('postage90', [('RP-103','A3',1)], (4250,0,90,175,4425)),
 ('postage500', [('RP-103','A3',2),('RP-101','A2',2)], (19800,0,500,320,20120)),
 ('postage2000', [('RP-103','A3',8),('RP-101','A2',4),('RP-108','A2',4)], (82400,7300,2000,495,75595)),
 ('collection2090', [('RP-103','A3',9),('RP-101','A2',4),('RP-108','A2',4)], (86650,7925,2090,0,78725)),
 ('new_historical_comparison', [('RP-101','A3',1)], (3795,0,90,175,3970)),
 ('mixed_order', [('RP-101','A3',2),('RP-105','A3',1),('RP-106','A3',5)], (32635,3125,720,495,30005)),
 ('address_positive', [('RP-105','A3',1)], (3795,0,90,175,3970)),
 ('authoritative_price', [('RP-106','A2',1)], (6450,0,160,320,6770)),
 ('quantity_positive', [('RP-103','A3',1)], (4250,0,90,175,4425)),
 ('combined_quantity', [('RP-103','A3',5)], (21250,3125,450,320,18445)),
 ('stale_basket_positive', [('RP-102','A3',8)], (30360,3040,720,495,27815)),
 ('checkout_retry', [('RP-108','A2',1)], (6450,0,160,320,6770)),
 ('cancellation', [('RP-108','A3',5)], (21250,3125,450,320,18445)),
 ('concurrent_last_a3', [('RP-104','A3',1)], (3795,0,90,175,3970)),
 ('last_a2', [('RP-104','A2',1)], (5650,0,160,320,5970)),
 ('successive_regular', [('RP-101','A2',2)], (11300,0,320,320,11620)),
 ('successive_trade', [('RP-101','A2',3)], (16950,1725,480,320,15545)),
]
arithmetic = []
for name, lines, expected in cases:
    actual = calculate(lines)
    assert tuple(actual.values()) == expected, (name, actual, expected)
    arithmetic.append({'name': name, 'lines': lines, 'actual_pence_and_grams': actual, 'passed': True})
historic = seed['orders'][0]
assert historic['subtotal_pence'] == sum(x['base_unit_price_pence'] * x['qty'] for x in historic['lines']) == 7000
assert historic['total_pence'] == 7320 and historic['status'] == 'dispatched'
stock = {key: v['in_stock'] for key,v in variants.items()}
transitions = []
def move(name, lines, direction=-1):
    before = {f'{a}/{b}': stock[a,b] for a,b,_ in lines}
    for sku,size,qty in lines:
        stock[sku,size] += direction * qty
        assert stock[sku,size] >= 0, (name, sku, size)
    transitions.append({'name': name, 'before': before, 'after': {f'{a}/{b}': stock[a,b] for a,b,_ in lines}})
move('gate', [('RP-105','A3',1)])
move('historical_comparison', [('RP-101','A3',1)])
move('mixed', [('RP-101','A3',2),('RP-105','A3',1),('RP-106','A3',5)])
move('address_two_valid_controls', [('RP-105','A3',2)])
move('monetary_positive', [('RP-106','A2',1)])
move('combined_quantity_controls', [('RP-103','A3',6)])
move('stale_basket_positive', [('RP-102','A3',8)])
move('retry_two_new_purchases', [('RP-108','A2',2)])
move('cancellation_purchase', [('RP-108','A3',5)])
move('cancellation_return', [('RP-108','A3',5)], 1)
move('concurrent_two_successes_total', [('RP-104','A3',2)])
move('last_unit', [('RP-104','A2',1)])
move('successive_orders', [('RP-101','A2',5)])
move('restart_cancelled_control_purchase', [('RP-105','A3',1)])
move('restart_cancelled_control_return', [('RP-105','A3',1)], 1)
move('restart_placed_control', [('RP-105','A3',1)])
assert stock['RP-101','A3'] == 9 and stock['RP-105','A3'] == 2 and stock['RP-108','A3'] == 6
math_report = {'scope': 'Fresh independent seed arithmetic and planned-state derivation, not observations of an application run.', 'cases': arithmetic, 'historical_receipt_passed': True, 'transitions': transitions, 'normal_final_stock': {f'{a}/{b}': q for (a,b),q in stock.items()}, 'optional_authoritative_repricing': 'Two Weathers A2 ends at1 rather than2 if the altered monetary claim is correctly repriced and accepted; no later fixed-stock scenario uses it.', 'later_available_variants': [f'{a}/{b}' for (a,b),q in stock.items() if q > 0]}
(out / 'semantic-arithmetic-and-state.json').write_text(json.dumps(math_report, indent=2) + '\n')

# Every public product requirement is mapped before collecting the reverse view.
requirements = [
 ('R01','Public browse/order without accounts or payment form','instruction.md:1; checkout-note.md:7', ['populated_public_shop_loads','application_health_and_server_data','mixed_trade_prices_survive_order_lookup']),
 ('R02','Eight real supplied prints, images and thirteen variant facts','README.md:3-9', ['ridgeline_catalogue_cards_and_variant_details']),
 ('R03','Grid regular minimum over every offered size, stock state','README.md:5-7', ['ridgeline_catalogue_cards_and_variant_details','ridgeline_sold_out_cheapest_variant_keeps_grid_price']),
 ('R04','Mixed availability and sold-out offered editions stay visible','README.md:5', ['ridgeline_catalogue_cards_and_variant_details','variant_stock_and_valid_basket_boundary','ridgeline_sold_out_cheapest_variant_keeps_grid_price']),
 ('R05','Case-insensitive title search with reset','README.md:7', ['ridgeline_catalogue_title_search']),
 ('R06','Size filter includes sold-out editions','README.md:7', ['ridgeline_catalogue_size_filter']),
 ('R07','Paper filter includes sold-out editions','README.md:7', ['ridgeline_catalogue_paper_filter']),
 ('R08','Regular-grid-price ordering in both directions','README.md:7', ['ridgeline_catalogue_regular_price_ordering']),
 ('R09','Alphabetical title order in both directions','README.md:7', ['ridgeline_catalogue_alphabetical_title_ordering']),
 ('R10','Larger matching photograph and offered paper/stock/trade detail','README.md:9', ['ridgeline_catalogue_cards_and_variant_details']),
 ('R11','Per-variant threshold applies trade price to every sheet','README.md:13-15', ['trade_threshold_reversal_and_size_isolation','mixed_trade_prices_survive_order_lookup','combined_quantities_and_invalid_checkout_are_atomic']),
 ('R12','Different sizes and different prints do not pool for a tier','README.md:13', ['trade_threshold_reversal_and_size_isolation','mixed_trade_prices_survive_order_lookup']),
 ('R13','Repeated additions combine; dropping below threshold reverses saving','README.md:13', ['combined_quantities_and_invalid_checkout_are_atomic','trade_threshold_reversal_and_size_isolation']),
 ('R14','Trade offer visible before qualifying, saving afterward','README.md:15', ['ridgeline_catalogue_cards_and_variant_details','trade_threshold_reversal_and_size_isolation']),
 ('R15','Gross subtotal, saving, postage and payable remain separate','README.md:15', ['ridgeline_unplaced_basket_survives_full_reload','trade_threshold_reversal_and_size_isolation','mixed_trade_prices_survive_order_lookup']),
 ('R16','Inclusive weight bands and over-limit collection','README.md:19-21', ['postage_inclusive_boundaries_and_collection']),
 ('R17','Basket survives reload without another visitor inheriting it','checkout-note.md:3', ['ridgeline_unplaced_basket_survives_full_reload']),
 ('R18','Zero removes line and stays absent after reload','checkout-note.md:3', ['ridgeline_zero_quantity_removal_stays_empty']),
 ('R19','Excess basket quantity refused, availability shown, prior valid quantity retained','checkout-note.md:3', ['variant_stock_and_valid_basket_boundary']),
 ('R20','Name/address/city/postcode required and server-enforced atomically','checkout-note.md:5', ['ridgeline_incomplete_delivery_address_refuses_atomically']),
 ('R21','Address and amounts visible before commitment','checkout-note.md:7', ['mixed_trade_prices_survive_order_lookup']),
 ('R22','New order reference and lookup without original browser basket','checkout-note.md:7', ['application_health_and_server_data','mixed_trade_prices_survive_order_lookup']),
 ('R23','Unknown reference never substitutes another receipt','checkout-note.md:7', ['ridgeline_unknown_reference_does_not_substitute_receipt']),
 ('R24','Unplaced basket reserves no stock; stale multiline atomic refusal','checkout-note.md:11', ['stale_multiline_checkout_leaves_every_stock_unchanged']),
 ('R25','Simultaneous customers cannot buy same last copy','checkout-note.md:11', ['simultaneous_last_copy_commits_only_once']),
 ('R26','Exact remaining stock can be bought; fresh oversell refused','checkout-note.md:11', ['last_unit_order_and_fresh_oversell_refusal','successive_orders_use_remaining_stock_and_own_tiers']),
 ('R27','Invalid quantities/variant make whole order invalid','checkout-note.md:13', ['combined_quantities_and_invalid_checkout_are_atomic']),
 ('R28','Duplicate variants aggregate before stock and trade checks','checkout-note.md:13', ['combined_quantities_and_invalid_checkout_are_atomic']),
 ('R29','Client monetary claims cannot choose stored charges','checkout-note.md:15', ['authoritative_prices_on_fresh_checkout']),
 ('R30','Same completed attempt returns its original receipt without another deduction','checkout-note.md:19', ['checkout_retry_identity_and_new_purchase','restart_preserves_receipts_stock_and_retry_terminality']),
 ('R31','Reusing attempt with changed quantity or address is refused','checkout-note.md:21', ['checkout_retry_identity_and_new_purchase']),
 ('R32','A deliberate new purchase of the same basket gets a new reference','checkout-note.md:21', ['checkout_retry_identity_and_new_purchase']),
 ('R33','Receipt preserves original quantities/address/regular and charged prices','checkout-note.md:25', ['historical_receipt_uses_charged_prices','mixed_trade_prices_survive_order_lookup','successive_orders_use_remaining_stock_and_own_tiers']),
 ('R34','New order placed; cancel once restores exact stock and preserves receipt','checkout-note.md:27', ['cancellation_is_terminal_and_restores_stock_once']),
 ('R35','Cancelled status terminal even on original-checkout replay','checkout-note.md:29', ['cancellation_is_terminal_and_restores_stock_once','restart_preserves_receipts_stock_and_retry_terminality']),
 ('R36','Dispatched historical order cannot be cancelled or restore stock','checkout-note.md:29', ['cancellation_is_terminal_and_restores_stock_once']),
 ('R37','Restart keeps attempts/orders/statuses/stock without reseeding','checkout-note.md:29; integration.md:9', ['restart_preserves_receipts_stock_and_retry_terminality']),
 ('R38','Comfortable phone access','instruction.md:11', ['responsive_layout','visual_responsive_consistency']),
 ('R39','Comfortable keyboard browsing','instruction.md:11', ['labelled_controls_and_focus','theme_and_navigation']),
 ('R40','Working light/dark themes','instruction.md:11', ['theme_and_navigation','visual_color_and_contrast']),
 ('R41','Understandable action feedback and navigation','instruction.md:comfortable use; professional defaults', ['interaction_feedback','theme_and_navigation']),
 ('R42','Readable coherent typography/layout/hierarchy/craft','instruction.md:comfortable use; professional defaults', ['visual_typography','visual_spacing_and_layout','visual_hierarchy_and_scanability','visual_overall_craft']),
 ('R43','Local server data, React/Node/Express/SQLite runtime','integration.md:3-11', ['application_health_and_server_data','restart_preserves_receipts_stock_and_retry_terminality']),
 ('R44','Start path, port, health, DB_PATH, copied seed/assets','integration.md:5-7', ['application_health_and_server_data']),
 ('R45','Public assets/CDNs allowed, external backend prohibited','integration.md:11', ['application_health_and_server_data']),
]
ids = {c['id'] for c in all_criteria}
assert {i for *_, mapped in requirements for i in mapped} == ids
coverage = {'scope': 'Public-first semantic map. Framework identity is explicitly not proven by browser evidence; runtime/package assertions require coordinator checks.', 'requirements': [{'id': i,'requirement': text,'public_source': reference,'criteria': criteria} for i,text,reference,criteria in requirements], 'criteria': [{'id': c['id'],'weight': c['weight'],'requirements': [i for i,_,_,mapped in requirements if c['id'] in mapped]} for c in all_criteria]}
(out / 'semantic-requirement-coverage.json').write_text(json.dumps(coverage, indent=2) + '\n')

def lineno(name, text, old=False):
    data = baseline[name] if old else current[name]
    return next(n for n,s in enumerate(data.decode().splitlines(),1) if text in s)
f = 'tests/scored/functional/judge.toml'
p = 'tests/scored/polish/judge.toml'
fp = 'tests/scored/functional/prompt.md'
findings = [
 {'id':'keyboard_workflow_coverage','severity':'P1','quality_checks':[26,31,34], 'before':f'{p}:{lineno(p,"Use Tab to reach",True)}', 'counterexample':'Native search/sort/theme controls pass the old three-Tab sample while mouse-only print cards or basket return controls prevent keyboard browsing.', 'fix':'Existing labels/focus criterion now checks reachability of every named enabled control; existing theme/navigation criterion owns the bounded keyboard-only view route. No purchase or duplicated price/focus verdict.', 'after':f'{p}:{lineno(p,"Use the keyboard to reach")}; {p}:{lineno(p,"Now use only keyboard")}', 'status':'Resolved in source', 'run_evidence':'golden/boundary-observations.json: exact_keyboard_route_and_focus', 'run_verdict':'CONFIRMED corrected golden route passes'},
 {'id':'sold_out_paper_filter_coverage','severity':'P2','quality_checks':[26,31], 'before':f'{f}:{lineno(f,"Select the Munken",True)}', 'counterexample':counterexample, 'fix':'Add Colorplan Pristine White membership including Allotment to the existing paper-filter criterion; reset returns all eight.', 'after':f'{f}:{lineno(f,"Then select only Colorplan")}', 'status':'Resolved in source', 'run_evidence':'semantic-paper-counterexample.json; golden/boundary-observations.json: combined_discovery_empty_reset_and_native_sort', 'run_verdict':'CONFIRMED original gap by deterministic counterexample; corrected golden membership passes'},
 {'id':'unrequired_equal_price_tie_stability','severity':'P2','quality_checks':[27], 'before':f'{f}:{lineno(f,"any stable order",True)}', 'counterexample':'An ascending or descending sort can keep every price in the required group yet order equal-priced products differently; the public brief never specifies tie stability.', 'fix':'Replace any stable order with any order; retain both directions and comparison of the full collection.', 'after':f'{f}:{lineno(f,"Equal-price ties can use any order")}', 'status':'Resolved in source', 'run_evidence':'Source diff; golden native sort evidence confirms the ordinary case, not a deliberately unstable-sort app.', 'run_verdict':'NOT EXERCISED alternate implementation; source restriction removed'},
 {'id':'unrequired_same_origin_replay_target','severity':'P2','quality_checks':[27,32,48], 'before':f'{fp}:{lineno(fp,"Use same-origin in-page",True)}', 'counterexample':'A one-process app may serve localhost UI with requests to its same local Node server at 127.0.0.1 under observed CORS/credentials rules. Constraints permits that local topology; forcing a same-origin replay substitutes a different request.', 'fix':'Replay from the app page to its actual observed local server URL and policy, retaining prohibition of external backends and invented routes. Concurrency uses the same wording.', 'after':f'{fp}:{lineno(fp,"Send replays from")}', 'status':'Resolved in source', 'run_evidence':'Source comparison against Constraints origin allowances; no alternate-origin fixture run claimed.', 'run_verdict':'NOT EXERCISED alternate implementation; prompt inconsistency removed'},
 {'id':'restart_snapshot_covers_all_variants','severity':'P2','quality_checks':[26,31,35], 'before':f'{f}:{lineno(f,"every variant you recorded",True)}', 'counterexample':'The old setup explicitly recorded only Kiln. Reading the final every-recorded-variant comparison narrowly permits other depleted variants to reset to their seed quantities without a required before/after comparison.', 'fix':'Before the actual restart, record all thirteen identified variant quantities, including zero, from rendered details or observed catalogue data; compare the complete collection afterward. No expected earlier verdicts or hidden database enumeration.', 'after':f'{f}:{lineno(f,"Immediately before restarting")}', 'status':'Resolved in source after independent harness reviewer finding', 'run_evidence':'Companion golden evidence maps prior actual browser restart with all 13 before/after quantities; build_evidence_map.py binds the clarified final description.', 'run_verdict':'CONFIRMED existing exact browser restart evidence covers all 13 quantities; no new run claimed'},
]
(out / 'semantic-findings.json').write_text(json.dumps({'findings':findings,'source_hashes':hashes}, indent=2) + '\n')

inventory = json.loads((out / 'semantic-qc-inventory.json').read_text(encoding='utf-8-sig'))
unexercised = {10,15,16,17,18,19,20,21,22,23,46,47,50,52}
notes = {9:'Public network and config checked; image/runtime resource behavior belongs to coordinator.',13:'Public seed and source asset membership inspected; final image COPY and parity belong to coordinator.',26:'All 45 public requirement groups map to 37 criteria after fixes. Browser evidence does not identify framework/database engine; the prompts explicitly acknowledge that policy limitation.',35:'Shared order write/read and real process-restart observations are required; these prove behavior, not a particular database engine.',43:'Scoring policy has zero-weight gates and 0.05 Functional floor; actual shell gate-before-score control flow belongs to harness reviewer.',49:'Names, seed facts, monetary values, criterion totals and prompt/runtime concepts agree. Final launch/helper/image contract belongs to coordinator.',51:'All reviewed TOML/JSON parse; full shell/runtime validation belongs to coordinator.'}
quality = []
for item in inventory['quality']:
    n = item['number']
    status = 'Not exercised' if n in unexercised else 'Note' if n in notes else 'Pass'
    note = notes.get(n, 'Independent public-first semantic review; see bidirectional coverage, fresh arithmetic/state derivation, resolved findings and current source hashes.')
    if n in unexercised: note = 'Outside independent semantic scope; coordinator must use its actual golden/image/harness/package evidence. Prior PASS was not imported.'
    quality.append({'number':n,'id':item['id'],'status':status,'note':note,'findings':[finding for finding in findings if n in finding['quality_checks']]})
qc = {'scope':'Independent full semantic read of37 criteria/five prompts/shared context against public-first requirements. All53 entries enumerated; structural/runtime observations not performed by this agent remain explicitly unexercised. Root merges final whole-task evidence.', 'checks':quality, 'deterministic':[{'name':d['name'],'status':'Not exercised','output':'','note':'Enumerated from authoritative workbook; coordinator owns full deterministic execution. Local TOML/JSON/IDs/weights/hygiene assertions are separately recorded.'} for d in inventory['deterministic']], 'source_hashes':hashes}
assert len(qc['checks']) == 53 and len(qc['deterministic']) == 48
(out / 'qc_semantic_findings.json').write_text(json.dumps(qc, indent=2) + '\n')
adversarial = {'ridgeline_incomplete_delivery_address_refuses_atomically','authoritative_prices_on_fresh_checkout','combined_quantities_and_invalid_checkout_are_atomic','stale_multiline_checkout_leaves_every_stock_unchanged','checkout_retry_identity_and_new_purchase','cancellation_is_terminal_and_restores_stock_once','simultaneous_last_copy_commits_only_once','last_unit_order_and_fresh_oversell_refusal','restart_preserves_receipts_stock_and_retry_terminality'}
assert sum(c['weight'] for c in dimensions['functional']['criterion'] if c['id'] in adversarial) == 23
checks = {'passed':True,'baseline_zip_sha256':digest(baseline_path.read_bytes()),'public_requirements':45,'criteria':37,'functional_count':25,'functional_weight':35,'criterion_id_type_weight_signatures_unchanged':True,'arithmetic_cases':len(arithmetic),'stock_transitions':len(transitions),'adversarial_criteria':len(adversarial),'adversarial_weight':23,'source_hashes':hashes,'changed_semantic_files':[name for name,data in current.items() if baseline.get(name) != data]}
(out / 'semantic-source-checks.json').write_text(json.dumps(checks, indent=2) + '\n')
report = f'''# Ridgeline independent second semantic review

Read order: instruction, all three public notes and seed first; all 37 current criteria, five prompts and shared app context second; prior results were not used to supply verdicts. The current QC skill/references and all 53 quality/48 deterministic entries, including internal interpretations, were reviewed with public-network and staged-layout overrides applied.

Five concrete issues were found and corrected after reporting them to the coordinator, including the independent harness reviewer's incomplete restart-snapshot observation. The original baseline is ZIP `{digest(baseline_path.read_bytes())}`. This review does not repeat an earlier blanket no-gap assurance.

## Findings and corrections

''' + '\n\n'.join(f"- **{finding['id']} ({finding['severity']})**: `{finding['before']}`. {finding['counterexample'] if isinstance(finding['counterexample'],str) else 'A paper filter that additionally requires positive stock passes the original Munken witness but wrongly hides Allotment under Colorplan Pristine White.'} {finding['fix']} Current evidence: `{finding['after']}`. {finding['run_verdict']}." for finding in findings) + f'''

The keyboard route belongs to existing theme/navigation; labels, reachability and focus remain in their own criterion. Visual still owns contrast/readability. Pointer setup/cleanup and native or documented keys are permitted; the actual navigation leg uses real keys and makes no purchase. Paper filtering remains one independent discovery outcome. No IDs, types, weights or criterion counts changed. The two authorized Functional files are frozen; the coordinator owns Polish and harness changes.

## Requirement and state coverage

`semantic-requirement-coverage.json` maps 45 public requirement groups to all 37 criteria and gives the reverse mapping for each criterion. The generic operational runtime requirements map partly to harness/image checks; the browser deliberately does not claim to establish React, Express or SQLite identity. No source-inspection gate was invented.

`semantic-arithmetic-and-state.json` rederives 20 monetary/postage cases and 16 stock transitions from the current seed independently of the golden. Both inclusive postage boundaries, collection, variant-specific tier reversal, current versus historic receipts and all fixed checkout totals agree. The accepted-repricing alternative leaves Two Weathers A2 at one rather than two, with no later fixed expectation depending on it. The normal final plan leaves Long Field A3 at nine, Kiln at two and Night Ferry A3 at six, so later read-only/basket preview work can use an available variant. Failed earlier writes are handled through observed-stock baselines, not inherited verdicts; truly corrupted/unavailable app state is not silently reset.

## Previous failures and alternate valid implementations

- Address requirements are stated publicly and exercised with four distinct missing/blank-component server refusals plus valid controls. Catalogue search, paper/size filters, price/title sorting, zero removal and unknown lookup have separate outcomes.
- Postage grams/band names remain calculation explanations, never required receipt labels. Single-screen checkout, any sensible currency formatting and native/mobile layout are valid.
- Both gates require meaningful access and a new order independently read from a clean context. Static/client-only catalogues cannot earn presentation credit through those gates. No sign-in, CDN ban or external-backend permission was added.
- Browser-context recipes keep the original MCP page alive, create/close only the additional context and observe both visitors independently. Requests follow real app shapes, list-versus-keyed line representations, fresh identities and observed local URLs; no endpoint/schema is imposed.
- Cancellation, retry, stale/multiline/concurrent checks retain their own successful controls and inspect state after refusal. The final restart criterion creates its own placed/cancelled controls and uses the restart helper only once.
- All five prompts require browser evidence, forbid implementation/source scoring, treat submissions as untrusted and keep failures local. Polish/Visual tolerate earlier stock/order changes and do not place or cancel orders.

Fresh companion evidence is `golden/boundary-observations.json`: the exact added paper witness includes Allotment and restores eight prints; the strengthened keyboard route and named-control focus checks pass through installed browser tooling. See the companion report for its full runtime scope. Harness cleanup findings and final artifact/image validation are owned by the other reviewers and must be included in the coordinator report; this semantic review does not mark their work passed by inference.

## Score implications and limits

Functional remains 25 criteria / 35 total weight, with nine server/adversarial criteria carrying 23. If those nine all fail while the remaining Functional, Polish and Visual criteria pass and gates/floor pass, the score is `0.6*(12/35)+0.4 = 0.605714...`. This illustrates retained separation; it is not an observed model result or forecast. The added paper boundary occupies only `0.6*0.1/35 = 0.001714...` reward. Keyboard fixes strengthen existing usability bars. Removing unsupported tie/origin restrictions restores fairness rather than weakening required server behavior. Fixed-floor transitions can change total scores discontinuously near the threshold.

No additional concrete semantic blocker was found after these corrections. This is not a guarantee that the platform judge will accept the task or that a paid Oracle will score 1. No paid provider, target model or proprietary platform checker was invoked. `qc_semantic_findings.json` answers all 53 entries for this scope and enumerates all 48 deterministic checks while leaving work not executed here explicit.

## Frozen Functional files

- `tests/scored/functional/judge.toml`: `{hashes[f]}`
- `tests/scored/functional/prompt.md`: `{hashes[fp]}`

All reviewed file hashes are recorded in `semantic-source-checks.json`; final ZIP/source binding belongs to the coordinator.
'''
(out / 'SEMANTIC_REVIEW.md').write_text(report, encoding='utf-8')
print(json.dumps({k:v for k,v in checks.items() if k != 'source_hashes'}, indent=2))
