"""Exhaustive abstract credit bounds plus execution of the shipped score tool.

These are synthetic rubric outcomes, not model or Oracle measurements.
"""
from decimal import Decimal
import importlib.util
import itertools
import json
from pathlib import Path
import sys
import tomllib

sys.dont_write_bytecode = True

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/ridgeline-print-storefront'
before = tomllib.loads((OUT / 'functional-before.toml').read_text(encoding='utf-8'))
split_ids = {'ridgeline_catalogue_search_and_filter_membership', 'ridgeline_catalogue_price_and_title_ordering'}
display_ids = {'mixed_trade_prices_survive_order_lookup', 'successive_orders_use_remaining_stock_and_own_tiers'}
unchanged = [int(Decimal(str(c['weight'])) * 20) for c in before['criterion'] if c['id'] not in split_ids | display_ids]
sums = {0}
for weight in unchanged:
    sums |= {value + weight for value in sums}

maximum_delta = -1
maximum_floor = -1
delta_witness = floor_witness = None
states = 0
for bits in itertools.product((0, 1), repeat=5):
    old_control = 6 * all(bits[:3]) + 6 * all(bits[3:])
    new_control = 2 * sum(bits[:3]) + 3 * sum(bits[3:])
    for money in itertools.product(((0, 0), (0, 1), (1, 1)), repeat=2):
        old_display = 50 * sum(pair[0] for pair in money)
        new_display = 50 * sum(pair[1] for pair in money)
        for unaffected in sums:
            states += 1
            old_units = unaffected + old_control + old_display
            new_units = unaffected + new_control + new_display
            witness = {'controls': list(bits), 'money_before_after': [list(pair) for pair in money],
                       'unaffected_raw': unaffected / 20, 'old_raw': old_units / 20, 'new_raw': new_units / 20}
            if old_units > 35 and new_units - old_units > maximum_delta:
                maximum_delta = new_units - old_units
                delta_witness = witness
            if old_units <= 35 < new_units and new_units > maximum_floor:
                maximum_floor = new_units
                floor_witness = witness

assert maximum_delta == 107
assert maximum_floor == 142
assert delta_witness['new_raw'] - delta_witness['old_raw'] == 5.35

score_path = TASK / 'tests/tools/score.py'
spec = importlib.util.spec_from_file_location('ridgeline_score_policy', score_path)
score = importlib.util.module_from_spec(spec)
spec.loader.exec_module(score)


def actual_tool(name, raw, polish=1.0, visual=1.0):
    case = OUT / 'synthetic-score-cases' / name
    (case / 'gates').mkdir(parents=True, exist_ok=True)
    (case / 'scored').mkdir(parents=True, exist_ok=True)
    (case / 'gates/reward.json').write_text(json.dumps({'render': 1, 'constraints': 1}), encoding='utf-8')
    (case / 'scored/reward.json').write_text(json.dumps({'functional': raw / 35, 'polish': polish, 'visual': visual}), encoding='utf-8')
    assert score.main(case) == 0
    return json.loads((case / 'reward.json').read_text(encoding='utf-8'))


floor_before = actual_tool('floor-before', floor_witness['old_raw'])
floor_after = actual_tool('floor-after', floor_witness['new_raw'])
assert floor_before['reward'] == 0 and floor_after['reward'] == 0.5217

# The source tool rounds only the final reward. Find a valid presentation pair
# that realizes the largest rounded difference for the conditional raw bound.
rounded_max = -1
rounded_witness = None
for old_units in sorted(sums):
    # A maximum-gain split has old controls=0 and corrected displays=0.
    if old_units <= 35:
        continue
    for polish_ticks in range(5):
        for visual_ticks in range(25):
            p, v = polish_ticks / 4, visual_ticks / 24
            old_reward = round(0.6 * (old_units / 700) + 0.2 * p + 0.2 * v, 4)
            new_reward = round(0.6 * ((old_units + 107) / 700) + 0.2 * p + 0.2 * v, 4)
            gain = round(new_reward - old_reward, 4)
            if gain > rounded_max:
                rounded_max = gain
                rounded_witness = {'old_raw': old_units / 20, 'new_raw': (old_units + 107) / 20,
                                   'polish': p, 'visual': v}
assert rounded_max == 0.0918
rounded_before = actual_tool('conditional-before', rounded_witness['old_raw'], rounded_witness['polish'], rounded_witness['visual'])
rounded_after = actual_tool('conditional-after', rounded_witness['new_raw'], rounded_witness['polish'], rounded_witness['visual'])
assert round(rounded_after['reward'] - rounded_before['reward'], 4) == rounded_max

report = {'scope': 'Abstract outcome bounds with real score.py execution; not candidate performance, platform rubric or a paid Oracle',
          'passed': True, 'enumerated_states': states, 'attainable_unaffected_sums': len(sums),
          'split_only_raw_gain': 0.35, 'split_only_conditional_unrounded_reward_gain': 0.006,
          'display_correction_raw_gain': 5, 'combined_raw_gain': 5.35,
          'combined_conditional_unrounded_reward_gain': str(Decimal('.6') * Decimal('5.35') / Decimal(35)),
          'combined_max_published_reward_delta': rounded_max, 'conditional_witness': rounded_witness,
          'conditional_before_tool': rounded_before, 'conditional_after_tool': rounded_after,
          'floor_witness': floor_witness, 'floor_before_tool': floor_before, 'floor_after_tool': floor_after,
          'limits': 'Unchanged outcomes held fixed; old money credit implies new money credit. Newly correct receipt checks can restore false-negative credit. Floor unlocking is distinct from the conditional bound. Postage/context clarifications do not intentionally change existing behavior.'}
(OUT / 'score-bound-results.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: report[key] for key in ['passed', 'enumerated_states', 'combined_max_published_reward_delta', 'floor_witness']}))
