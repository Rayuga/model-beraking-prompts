"""Read-only checks for the Ridgeline follow-up rubric revision.

Preserves the earlier rubric as functional-before.toml. No app is mutated and
no paid judge is invoked. Run after the functional source is frozen.
"""
from decimal import Decimal
import difflib
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import tomllib

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/ridgeline-print-storefront'
SOURCE = TASK / 'tests/scored/functional/judge.toml'
checks = []


def read(path):
    return path.read_text(encoding='utf-8')


def check(name, passed, detail=None):
    checks.append({'name': name, 'passed': bool(passed), 'detail': detail})


def total(items):
    return sum((Decimal(str(item['weight'])) for item in items), Decimal(0))


before_text = read(OUT / 'functional-before.toml')
after_text = read(SOURCE)
before = tomllib.loads(before_text)
after = tomllib.loads(after_text)
old = {item['id']: item for item in before['criterion']}
new = {item['id']: item for item in after['criterion']}
groups = [
    {'old_id': 'ridgeline_catalogue_search_and_filter_membership', 'old_weight': 0.3,
     'new': [{'id': 'ridgeline_catalogue_title_search', 'weight': 0.1},
             {'id': 'ridgeline_catalogue_size_filter', 'weight': 0.1},
             {'id': 'ridgeline_catalogue_paper_filter', 'weight': 0.1}]},
    {'old_id': 'ridgeline_catalogue_price_and_title_ordering', 'old_weight': 0.3,
     'new': [{'id': 'ridgeline_catalogue_regular_price_ordering', 'weight': 0.15},
             {'id': 'ridgeline_catalogue_alphabetical_title_ordering', 'weight': 0.15}]}
]
clarified = {'mixed_trade_prices_survive_order_lookup', 'successive_orders_use_remaining_stock_and_own_tiers',
             'postage_inclusive_boundaries_and_collection', 'ridgeline_unplaced_basket_survives_full_reload'}
removed = {group['old_id'] for group in groups}
added = {item['id'] for group in groups for item in group['new']}
unchanged = sorted(set(old) - removed - clarified)
check('functional_count_unique_and_binary', len(after['criterion']) == len(new) == 24
      and all(item['type'] == 'binary' for item in new.values()), {'before': len(old), 'after': len(new)})
check('exact_total_weight_preserved', total(old.values()) == total(new.values()) == Decimal('35'),
      {'before': str(total(old.values())), 'after': str(total(new.values()))})
check('only_requested_ids_changed', set(old) - set(new) == removed and set(new) - set(old) == added,
      {'removed': sorted(removed), 'added': sorted(added)})
check('split_group_weights', all(Decimal(str(old[group['old_id']]['weight'])) == total(group['new'])
      and all(new[item['id']]['weight'] == item['weight'] for item in group['new']) for group in groups), groups)
check('unchanged_criteria_identical', all(old[key] == new[key] for key in unchanged), unchanged)
check('clarifications_preserve_identity_and_weights', all({k: v for k, v in old[key].items() if k != 'description'}
      == {k: v for k, v in new[key].items() if k != 'description'} for key in clarified), sorted(clarified))
check('judge_wiring_and_budget_identical', {k: v for k, v in before.items() if k != 'criterion'}
      == {k: v for k, v in after.items() if k != 'criterion'}, '9000-second budget, MCPs and aggregation unchanged')
check('money_checks_drop_unrequested_display',
      '720 g' not in new['mixed_trade_prices_survive_order_lookup']['description']
      and 'Small parcel' not in new['mixed_trade_prices_survive_order_lookup']['description']
      and '480 g' not in new['successive_orders_use_remaining_stock_and_own_tiers']['description']
      and 'it need not display grams or a postage-band name' in new['postage_inclusive_boundaries_and_collection']['description'],
      'Required monetary figures retained; grams/band names are calculation facts, not screen requirements')
check('new_controls_have_independent_setups', all('Independently start from all eight prints' in new[key]['description'] for key in added),
      'Each new control begins from an unfiltered full catalogue')

seed = json.loads(read(TASK / 'environment/assets/seed_data.json'))
variants = {(row['sku'], row['size']): row for row in seed['variants']}
titles = sorted({row['title'] for row in variants.values()})
search = sorted({row['title'] for row in variants.values() if 'harbour' in row['title'].casefold()})
size = sorted({row['title'] for row in variants.values() if row['size'] == 'A2'})
paper = sorted({row['title'] for row in variants.values() if row['stock_sheet'] == 'Munken Pure Rough 240gsm'})
prices = {title: min(row['price_pence'] for row in variants.values() if row['title'] == title) for title in titles}
check('search_expected_membership', search == ['Harbour Mouth'] and '"hArBoUr"' in new['ridgeline_catalogue_title_search']['description'], search)
check('size_expected_membership_includes_sold_out', size == ['Harbour Mouth', 'Long Field', 'Night Ferry', 'Slack Water', 'Two Weathers']
      and variants[('RP-102', 'A2')]['in_stock'] == 0, size)
check('paper_expected_membership', paper == ['Harbour Mouth', 'Slack Water', 'Two Weathers'], paper)
check('price_expected_groups', len([v for v in prices.values() if v == 3795]) == 5
      and len([v for v in prices.values() if v == 4250]) == 3, prices)
check('alphabetical_expected_order', ', '.join(titles) in new['ridgeline_catalogue_alphabetical_title_ordering']['description'], titles)

weights = {row['size']: row['grams'] for row in seed['size_weights']}
bands = sorted((row for row in seed['postage_bands'] if row['up_to_grams'] > 0), key=lambda row: row['up_to_grams'])


def calculate(lines):
    gross = net = grams = 0
    for sku, size_name, quantity in lines:
        row = variants[(sku, size_name)]
        gross += quantity * row['price_pence']
        unit = row['tier_price_pence'] if quantity >= row['tier_qty'] else row['price_pence']
        net += quantity * unit
        grams += quantity * weights[size_name]
    band = next((row for row in bands if grams <= row['up_to_grams']), None)
    postage = band['price_pence'] if band else 0
    return {'gross': gross, 'saving': gross - net, 'grams': grams, 'postage': postage,
            'total': net + postage, 'collection_only': band is None}


math_cases = {
    'mixed_order': calculate([('RP-101', 'A3', 2), ('RP-105', 'A3', 1), ('RP-106', 'A3', 5)]),
    'successive_first': calculate([('RP-101', 'A2', 2)]),
    'successive_second': calculate([('RP-101', 'A2', 3)]),
    'single_a3': calculate([('RP-103', 'A3', 1)]),
    'boundary_500': calculate([('RP-103', 'A3', 2), ('RP-101', 'A2', 2)]),
    'boundary_2000': calculate([('RP-103', 'A3', 8), ('RP-101', 'A2', 4), ('RP-108', 'A2', 4)]),
    'above_2000': calculate([('RP-103', 'A3', 9), ('RP-101', 'A2', 4), ('RP-108', 'A2', 4)])
}
check('mixed_money_independently_recomputed', math_cases['mixed_order'] == {
      'gross': 32635, 'saving': 3125, 'grams': 720, 'postage': 495, 'total': 30005, 'collection_only': False}, math_cases['mixed_order'])
check('successive_money_independently_recomputed', math_cases['successive_first'] == {
      'gross': 11300, 'saving': 0, 'grams': 320, 'postage': 320, 'total': 11620, 'collection_only': False}
      and math_cases['successive_second'] == {'gross': 16950, 'saving': 1725, 'grams': 480, 'postage': 320, 'total': 15545, 'collection_only': False},
      {key: math_cases[key] for key in ('successive_first', 'successive_second')})
check('inclusive_postage_calculations_preserved',
      [(math_cases[key]['grams'], math_cases[key]['postage'], math_cases[key]['collection_only'])
       for key in ('single_a3', 'boundary_500', 'boundary_2000', 'above_2000')]
      == [(90, 175, False), (500, 320, False), (2000, 495, False), (2090, 0, True)],
      {key: math_cases[key] for key in ('single_a3', 'boundary_500', 'boundary_2000', 'above_2000')})
basket = new['ridgeline_unplaced_basket_survives_full_reload']['description']
check('two_context_tool_recipe_present', all(s in basket for s in ['browser_run_code_unsafe', 'page.context().browser()',
      'newContext(', 'newPage(', 'storageState', 'finally', 'close()', 'Do not place an order']),
      'Explicit pinned browser tool, independent context, no copied storage, cleanup and no purchases')

all_criteria = [c for path in (TASK / 'tests').rglob('judge.toml') for c in tomllib.loads(read(path))['criterion']]
check('all_criterion_ids_unique', len(all_criteria) == len({c['id'] for c in all_criteria}) == 36,
      {'criteria': len(all_criteria), 'public_files': 4})
for filename, output in [('check_public_criterion_ids.py', 'public-id-check.json'), ('check_public_grader_terms.py', 'public-grader-term-check.json')]:
    module_path = ROOT / 'scripts' / filename
    spec = importlib.util.spec_from_file_location(module_path.stem, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = module.scan_task(TASK)
    (OUT / output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    check(filename, result['passed'], result)

score_cases = []
for outcomes in itertools.product((0, 1), repeat=5):
    old_credit = Decimal('.3') * all(outcomes[:3]) + Decimal('.3') * all(outcomes[3:])
    new_credit = sum(Decimal('.1') * flag for flag in outcomes[:3]) + sum(Decimal('.15') * flag for flag in outcomes[3:])
    score_cases.append({'outcomes': list(outcomes), 'old_raw': str(old_credit), 'new_raw': str(new_credit), 'gain': str(new_credit - old_credit)})
max_gain = max(Decimal(case['gain']) for case in score_cases)
check('split_score_bound_exhaustive', max_gain == Decimal('.35'), {'cases': len(score_cases), 'max_raw_gain': str(max_gain),
      'max_conditional_unrounded_reward_gain': str(Decimal('.6') * max_gain / Decimal(35))})
crosswalk = {'old_count': 21, 'new_count': 24, 'old_weight': 35, 'new_weight': 35, 'groups': groups,
             'unchanged_criterion_ids': unchanged, 'description_only_clarifications': sorted(clarified),
             'split_score_cases': score_cases, 'max_split_raw_gain': str(max_gain), 'max_split_conditional_reward_gain': '0.006',
             'display_correction': {'criterion_ids': ['mixed_trade_prices_survive_order_lookup', 'successive_orders_use_remaining_stock_and_own_tiers'],
                                    'combined_raw_weight': 5, 'max_conditional_reward_restored': str(Decimal('.6') * Decimal(5) / Decimal(35)),
                                    'meaning': 'Only an otherwise-correct submission failed solely for missing unrequested grams/band text could regain these points.'},
             'limits': 'Conditional on gates and functional floor already passing; not a measured model score. Postage and context wording clarify intended existing behavior.'}
(OUT / 'criterion-crosswalk.json').write_text(json.dumps(crosswalk, indent=2) + '\n', encoding='utf-8')
(OUT / 'functional-source.diff').write_text(''.join(difflib.unified_diff(before_text.splitlines(keepends=True),
      after_text.splitlines(keepends=True), fromfile='functional-before.toml', tofile='tests/scored/functional/judge.toml')), encoding='utf-8')
result = {'scope': 'Frozen rubric contract checks and independent seed arithmetic; not platform QC, model grading or Oracle execution',
          'passed': all(item['passed'] for item in checks), 'check_count': len(checks), 'checks': checks, 'math_cases': math_cases,
          'before_sha256': hashlib.sha256((OUT / 'functional-before.toml').read_bytes()).hexdigest(),
          'functional_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest()}
(OUT / 'contract-checks.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': result['passed'], 'checks': len(checks), 'failures': [row for row in checks if not row['passed']],
                  'functional_sha256': result['functional_sha256']}, indent=2))
raise SystemExit(0 if result['passed'] else 1)
