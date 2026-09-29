import argparse
import hashlib
import itertools
import json
import tomllib
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--task', type=Path, default=Path('projects/ridgeline-print-storefront'))
parser.add_argument('--output', type=Path)
args = parser.parse_args()
task = args.task
out = args.output or Path(__file__).with_name('revision_preflight.json')
checks = []

def check(name, ok):
    checks.append({'name': name, 'passed': bool(ok)})

def read(relative):
    return (task / relative).read_text(encoding='utf-8')

functional = tomllib.loads(read('tests/scored/functional/judge.toml'))['criterion']
check('functional count21 and weight35', len(functional) == 21 and abs(sum(c['weight'] for c in functional) - 35) < 1e-8)
for prompt in sorted((task / 'tests').glob('*/*/prompt.md')):
    check(prompt.parent.name + ': explicit implementation evidence prohibition', 'Do not inspect submitted source files' in prompt.read_text(encoding='utf-8'))
constraint = read('tests/gates/constraints/judge.toml')
check('constraints requires newly written independently retrieved order', all(s in constraint for s in ['newly chosen recipient', 'separate browser context', 'no copied cookies', 'Reload this fresh context', 'static catalogue response']))
check('offline prerequisite uses observed network traffic', 'runtime CDN script' in constraint and 'actual browser requests' in constraint)
for dimension in ['functional', 'polish', 'visual']:
    text = read('tests/scored/' + dimension + '/prompt.md')
    check(dimension + ': requires passed server gate and no repeated gate purchase', 'constraints gate' in text and 'Do not repeat' in text and 'reload' in text)
    check(dimension + ': explicit source ban', 'do not use them as scoring evidence' in text)
installer = read('solution/solve.sh')
check('installation reset restricted to canonical SQLite files', 'database_files=(/app/app.db /app/app.db-wal /app/app.db-shm)' in installer and 'rm -f -- "${database_files[@]}"' in installer)
check('normal verifier startup does not execute installer', 'solve.sh' not in read('tests/test.sh'))
address = next(c for c in functional if c['id'] == 'ridgeline_incomplete_delivery_address_refuses_atomically')
check('address positive controls and four independent fresh attempts', all(s in address['description'] for s in ['four separate fresh', 'recipient name', 'address line', 'city', 'postcode', 'separate NEW', 'stop further probe orders']))
check('address missing fields funded without raising total weight', address['weight'] == 2 and next(c for c in functional if c['id'] == 'trade_threshold_reversal_and_size_isolation')['weight'] == 1 and next(c for c in functional if c['id'] == 'postage_inclusive_boundaries_and_collection')['weight'] == 1)

old_zip = Path('deliverables/ridgeline-print-storefront/hardening-2026-09-26-round2/ridgeline-print-storefront.zip')
with zipfile.ZipFile(old_zip) as archive:
    old = tomllib.loads(archive.read('ridgeline-print-storefront/tests/scored/functional/judge.toml').decode())['criterion']
    for relative in ['tests/scoring.toml', 'tests/tools/score.py', 'tests/tools/restart_mcp.py', 'tests/scored/polish/judge.toml', 'tests/scored/visual/judge.toml']:
        check(relative + ': unchanged', archive.read('ridgeline-print-storefront/' + relative) == (task / relative).read_bytes())

changed_old = {'catalogue_discovery_and_real_prints', 'unplaced_basket_reload_and_zero_removal', 'historical_receipt_uses_charged_prices', 'trade_threshold_reversal_and_size_isolation', 'postage_inclusive_boundaries_and_collection'}
check('baseline comparison has exact five changed scoring groups', len([c for c in old if c['id'] in changed_old]) == 5)
remaining = [c['weight'] for c in old if c['id'] not in changed_old]
possible_unchanged = {sum(w * bit for w, bit in zip(remaining, bits)) for bits in itertools.product([0, 1], repeat=len(remaining))}

def reward(raw):
    fraction = raw / 35
    return 0.0 if fraction <= 0.05 else 0.4 + 0.6 * fraction

largest_clear = largest_any = 0
published_clear = published_any = 0
witness = None
for bits in itertools.product([0, 1], repeat=10):
    ca, cb, cc, br, bz, hp, hu, trade, postage, address_ok = bits
    old_raw = ca*cb*cc + 1.5*br*bz + 1.5*hp*hu + 2*trade + 2*postage
    new_raw = .4*ca + .3*cb + .3*cc + .75*br + .75*bz + 1.25*hp + .25*hu + trade + postage + 2*address_ok
    for unchanged in possible_unchanged:
        old_total, new_total = old_raw + unchanged, new_raw + unchanged
        increase = reward(new_total) - reward(old_total)
        published_increase = round(reward(new_total), 4) - round(reward(old_total), 4)
        published_any = max(published_any, published_increase)
        if old_total / 35 > .05 and new_total / 35 > .05:
            largest_clear = max(largest_clear, increase)
            published_clear = max(published_clear, published_increase)
        if increase > largest_any:
            largest_any = increase
            witness = {'old_functional_raw': old_total, 'new_functional_raw': new_total, 'old_reward': reward(old_total), 'new_reward': reward(new_total), 'bits': list(bits)}

result = {'scope': 'Local regression assertions and mathematical redistribution bounds, not paid judging or model predictions. Old/new gates assumed passed, presentation both1. Added restrictions can lower results; bit combinations need not all describe a realizable submission.',
          'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'checks': checks,
          'score_analysis': {'upper_increase_if_both_clear_functional_floor': largest_clear, 'upper_increase_including_floor_crossing': largest_any, 'published_four_decimal_upper_increase_if_both_clear_floor': round(published_clear, 4), 'published_four_decimal_upper_increase_including_floor_crossing': round(published_any, 4), 'floor_crossing_witness': witness, 'both_gates_passed_assumption': True},
          'source_hashes': {p.relative_to(task).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(task.rglob('*')) if p.is_file()}}
out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: result[key] for key in ['passed', 'failed', 'score_analysis']}, indent=2))
if result['failed']:
    raise SystemExit(1)
