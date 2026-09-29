"""Fresh contract/delta and conditional score audit; no paid judgments are made."""
import sys
sys.dont_write_bytecode = True
import difflib
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/colderwater-playground-devtools'
TEMPLATE = ROOT / 'projects/webdev-task-template'
BASE = OUT.parent / 'network-policy-fix-2026-09-26/colderwater-playground-devtools.zip'
BASE_SHA = '998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686'
checks = []

def read(path):
    return path.read_text(encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

def check(name, passed, detail):
    checks.append({'name': name, 'passed': bool(passed), 'detail': detail})

def module_at(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

with zipfile.ZipFile(BASE) as archive:
    base_files = {}
    for name in archive.namelist():
        if name.endswith('/'):
            continue
        relative = name.partition('/')[2] if name.startswith('colderwater-playground-devtools/') else name
        base_files[relative] = archive.read(name)

judge_path = 'tests/scored/functional/judge.toml'
old = tomllib.loads(base_files[judge_path].decode())
new = tomllib.loads(read(TASK / judge_path))
old_ids = {c['id']: c for c in old['criterion']}
new_ids = {c['id']: c for c in new['criterion']}
changed = sorted(k for k in old_ids if old_ids[k] != new_ids.get(k))
unchanged = sorted(k for k in old_ids if old_ids[k] == new_ids.get(k))
added = sorted(set(new_ids) - set(old_ids))
public = [TASK / 'instruction.md', *sorted((TASK / 'environment/instructions').glob('*.md'))]
config = tomllib.loads(read(TASK / 'task.toml'))
template = tomllib.loads(read(TEMPLATE / 'task.toml'))
judges = {p.relative_to(TASK).as_posix(): tomllib.loads(read(p)) for p in (TASK / 'tests').rglob('judge.toml')}
all_criteria = [c for j in judges.values() for c in j['criterion']]

check('baseline_identity', digest(BASE) == BASE_SHA, digest(BASE))
check('functional_inventory', len(old_ids) == 32 and len(new_ids) == 33 and sum(c['weight'] for c in new_ids.values()) == 49.5,
      {'old': len(old_ids), 'new': len(new_ids), 'weight': sum(c['weight'] for c in new_ids.values())})
check('overall_inventory', len(judges) == 5 and len(all_criteria) == 45 and len({c['id'] for c in all_criteria}) == 45,
      {'dimensions': len(judges), 'criteria': len(all_criteria)})
check('exact_functional_delta', changed == ['auto_run', 'cw_theme_switch_legibility', 'fresh_cancel', 'language_dispatch']
      and added == ['cw_runtime_files_not_publicly_exposed'] and len(unchanged) == 28 and not set(old_ids) - set(new_ids),
      {'changed_existing': changed, 'new': added, 'identical': len(unchanged)})
check('all_functional_binary', all(c['type'] == 'binary' and c['weight'] > 0 for c in new_ids.values()), '33 positive-weight binary criteria')
check('funding_and_preserved_weights', old_ids['fresh_cancel']['weight'] == 3 and new_ids['fresh_cancel']['weight'] == 2.5
      and new_ids[added[0]]['weight'] == .5 and all(old_ids[k]['weight'] == new_ids[k]['weight'] for k in old_ids if k != 'fresh_cancel'),
      'Exactly 0.5 moved from cancellation to independent confidentiality; all other weights fixed')
check('judge_profile_and_budget_unchanged', old['judge'] == new['judge'] and old['scoring'] == new['scoring'] and new['judge']['timeout'] == 9000,
      'Judge/MCP/mode/isolation/weighted mean and 9000-second budget match baseline')
check('task_profile_matches_template', set(config) == set(template)
      and all(set(config[s]) == set(template[s]) for s in ('task', 'metadata'))
      and all(config[s] == template[s] for s in ('agent', 'environment', 'verifier'))
      and config['schema_version'] == template['schema_version'] and config['artifacts'] == template['artifacts'],
      'No extra config keys, timeout drift or verifier environment change')
check('metadata_current', '33 binary functional criteria' in config['metadata']['difficulty_explanation']
      and '49.5' in config['metadata']['difficulty_explanation'] and 'installed RewardKit 0.1.7 raw 1-5' in config['metadata']['difficulty_explanation'],
      'Counts, scale and measured-score limitations are stated')
score_policy = tomllib.loads(read(TASK / 'tests/scoring.toml'))
check('canonical_score_policy', score_policy == {'gates': {'render': 0.0, 'constraints': 0.0},
      'weights': {'functional': .6, 'polish': .2, 'visual': .2}, 'floors': {'functional': .05}}, score_policy)
check('public_docs_and_seed', len(public) == 7 and (TASK / 'environment/assets/seed_data.json').is_file(), 'Seven public files and canonical seed')
for name in ('check_public_criterion_ids.py', 'check_public_grader_terms.py', 'check_public_network_policy.py'):
    result = module_at(ROOT / 'scripts' / name, 'contract_' + Path(name).stem).scan_task(TASK)
    write('contract_' + Path(name).stem + '.json', result)
    check(name, result['passed'], {k: v for k, v in result.items() if k != 'matches'})

descs = {k: c['description'] for k, c in new_ids.items()}
behavior = read(TASK / 'environment/instructions/behaviour.md')
security = read(TASK / 'environment/instructions/security.md')
prompt = read(TASK / 'tests/scored/functional/prompt.md')
check('stop_notice_and_supersession_distinguished', 'when I use it, show that I stopped the run' in behavior
      and 'notification that A was superseded is optional' in descs['fresh_cancel']
      and 'visible stopped/cancelled reason' in descs['fresh_cancel'] and 'cancel-A-delayed must never appear' in descs['fresh_cancel'],
      'Stop feedback explicit; replacement judged by lifecycle outcomes')
check('css_handler_working_control_and_removal', all(s in descs['language_dispatch'] for s in ["addEventListener('click'", 'Click its Try handler',
      'proving the original handler works', 'no new dispatch-handler-marker', 'must neither rerun', 'deliberately does not mutate']),
      'Log-only listener has a positive click before CSS and a negative click after CSS, without hidden DOM snapshot semantics')
check('debounce_reset_measured_not_hardcoded', all(s in descs['auto_run'] for s in ['Measure the observed delay', 'closer together than the observed delay',
      'beyond the time when the first edit alone would have run', 'No intermediate version executes', 'Record the actual edit timings',
      'repeat it once', 'Do not require a particular debounce millisecond']),
      'Later-edit reset is tested using observed timing; missed setup is distinguished from a product failure')
check('theme_mechanics_not_aesthetics', all(s in descs['cw_theme_switch_legibility'] for s in ['theme-control-preview', 'exact editor source',
      'actually affect the workspace chrome, editor and console', 'remain intact', 'visual criteria own contrast', 'or theme persistence after reload']),
      'Same ID/weight, two real switches with state preservation; readability belongs to Visual')
privacy = descs['cw_runtime_files_not_publicly_exposed']
check('privacy_public_anchor', 'server entrypoint, package manifest and SQLite database belong on the server' in security
      and 'Public browser scripts are fine' in security, 'Named files are existing runtime files, not required HTTP endpoints')
check('privacy_positive_control_scope', all(s in privacy for s in ['confidentiality-control-preview', 'successful browser HTTP read',
      'exactly /app.db, /server.js and /package.json', 'not required endpoints', 'Do not follow redirects off', 'another ordinary own-document']),
      'Working controls and exactly three browser HTTP probes; no discovery/source filesystem')
check('privacy_content_not_status', all(s in privacy for s in ['exact SQLite header', 'first 16 bytes', 'server-side import/require evidence',
      'executable server initialization', 'BOTH a server-start command and server-only dependency', 'frontend package manifest',
      'comments or string literals', 'a non-200 response that actually delivers recognizable private content']),
      'Actual recognizable file evidence; public JavaScript/JSON, SPA HTML and MIME/status decoys are valid')
check('privacy_bounded_without_hidden_size_limit', all(s in privacy for s in ['up to 64 KiB', 'Cancel the response reader',
      'Reaching the 64 KiB limit completes', 'no response-size limit for valid public assets', 'Only positive private-file evidence fails',
      'Actual transport failures', 'no recognizable private content in that prefix']), 'Completed bounded prefix without signature passes limited probe; missing observation cannot establish pass')
check('privacy_exception_narrow_and_consistent', all(s in prompt for s in ['sole narrow exception', 'no filesystem/source access',
      'not a failure without positive private-file evidence', 'Missing transport/setup', 'All other criteria retain'])
      and 'Inspect response bytes only for the narrowly allowed file-type classifications' in privacy,
      'Functional-only byte classification, no private body output/application logic/secret extraction')
check('independent_restart_stays_last', new['criterion'][-1]['id'] == 'cw_process_restart_durability'
      and 'criterion\'s own durable controls' in descs['cw_process_restart_durability']
      and 'restart_app exactly once' in descs['cw_process_restart_durability'], 'Own state, one real final restart; privacy does not run afterward')
check('gate_created_records_preserved', 'gate may already have saved a record' in descs['initial_examples']
      and 'do not require an empty library' in descs['initial_examples']
      and 'Other criteria\'s unrelated snippets must remain untouched' in descs['delete_confirm'], 'Startup and mutation chains accept existing gate records')
check('source_inspection_forbidden_elsewhere', all('implementation' in read(TASK / path.parent / 'prompt.md').lower()
      for path in [Path(p) for p in judges if p != judge_path]), 'All other dimension prompts keep implementation-inspection bans')

owned = ['instruction.md', *[p.relative_to(TASK).as_posix() for p in public[1:]], judge_path,
         'tests/scored/functional/prompt.md', 'task.toml']
delta = []
for relative in owned:
    now = (TASK / relative).read_bytes()
    before = base_files[relative]
    if now != before:
        delta.append({'path': relative, 'before_sha256': hashlib.sha256(before).hexdigest(), 'after_sha256': hashlib.sha256(now).hexdigest()})
        diff = ''.join(difflib.unified_diff(before.decode().splitlines(True), now.decode().splitlines(True),
                    fromfile='baseline/' + relative, tofile='current/' + relative))
        (OUT / ('delta-' + relative.replace('/', '__') + '.diff')).write_text(diff, encoding='utf-8')

crosswalk = {'baseline_archive_sha256': BASE_SHA, 'current_functional_sha256': digest(TASK / judge_path),
    'old_count': 32, 'new_count': 33, 'old_weight': 49.5, 'new_weight': 49.5,
    'funding_group': {'old': [{'id': 'fresh_cancel', 'weight': 3}], 'new': [{'id': 'fresh_cancel', 'weight': 2.5},
        {'id': 'cw_runtime_files_not_publicly_exposed', 'weight': .5}]},
    'other_changed_same_weight': [{'id': k, 'weight': new_ids[k]['weight']} for k in changed if k != 'fresh_cancel'],
    'identical_criterion_objects': unchanged, 'owned_file_delta': delta,
    'inventory': [{'id': c['id'], 'weight': c['weight']} for c in new['criterion']]}
write('functional-crosswalk.json', crosswalk)

# Enumerate realizable unchanged raw scores (quarter-point units) and every
# changed-behavior assignment. P=V=1 witnesses the maximal published gain found.
attainable = {0}
for key in unchanged:
    units = round(old_ids[key]['weight'] * 4)
    attainable |= {n + units for n in attainable}
max_conditional = {'delta': -999}
max_floor_unlock = {'delta': -999}
max_raw_gain = -999
min_raw_gain = 999
state_count = 0
for C, N, P, S, L, H, D, E, A, R in itertools.product((0, 1), repeat=10):
    old_block = 3*C*N + .5*S*L + 2.5*D + 2*A
    new_block = 2.5*C + .5*P + .5*S*H + 2.5*D*E + 2*A*R
    max_raw_gain = max(max_raw_gain, new_block-old_block)
    min_raw_gain = min(min_raw_gain, new_block-old_block)
    flags = dict(zip(('cancellation', 'supersession_notice', 'privacy', 'theme_switch', 'old_theme_readability',
                      'theme_state_retained', 'old_dispatch', 'css_handler_removed', 'old_autorun', 'debounce_reset'),
                     (C, N, P, S, L, H, D, E, A, R)))
    for unit in sorted(attainable):
        state_count += 1
        old_raw = unit/4 + old_block
        new_raw = unit/4 + new_block
        old_pass = old_raw/49.5 > .05
        new_pass = new_raw/49.5 > .05
        old_reward = round(.6*old_raw/49.5 + .4, 4) if old_pass else 0
        new_reward = round(.6*new_raw/49.5 + .4, 4) if new_pass else 0
        example = {'delta': round(new_reward-old_reward, 4), 'unchanged_raw': unit/4,
                   'old_raw': old_raw, 'new_raw': new_raw, 'old_reward': old_reward, 'new_reward': new_reward,
                   'polish': 1, 'visual': 1, 'flags': flags}
        if old_pass and new_pass and example['delta'] > max_conditional['delta']:
            max_conditional = example
        if not old_pass and new_pass and example['delta'] > max_floor_unlock['delta']:
            max_floor_unlock = example

score = module_at(TASK / 'tests/tools/score.py', 'functional_delta_score')
for label, example in [('conditional', max_conditional), ('floor-unlock', max_floor_unlock)]:
    for side in ('old', 'new'):
        folder = OUT / 'functional-score-witnesses' / label / side
        (folder / 'gates').mkdir(parents=True, exist_ok=True)
        (folder / 'scored').mkdir(exist_ok=True)
        (folder / 'gates/reward.json').write_text(json.dumps({'render': 1, 'constraints': 1}))
        (folder / 'scored/reward.json').write_text(json.dumps({'functional': example[side + '_raw']/49.5, 'polish': 1, 'visual': 1}))
        score.main(folder)
        actual = json.loads(read(folder / 'reward.json'))['reward']
        check('actual_score_' + label + '_' + side, actual == example[side + '_reward'], {'expected': example[side + '_reward'], 'actual': actual})

score_evidence = {'scope': 'Functional changes only; held-fixed behavior abstraction, not model-score prediction. Visual edits are separate.',
    'variables': {'C': 'real cancellation passes', 'N': 'formerly demanded supersession notice', 'P': 'new bounded privacy passes',
        'S': 'theme actually switches', 'L': 'old aesthetic legibility passes', 'H': 'new theme state preservation passes',
        'D': 'old dispatch passes', 'E': 'added CSS handler removal passes', 'A': 'old autorun passes', 'R': 'added edit-reset passes'},
    'old_changed_raw': '3*C*N + .5*S*L + 2.5*D + 2*A',
    'new_changed_raw': '2.5*C + .5*P + .5*S*H + 2.5*D*E + 2*A*R',
    'states_enumerated': state_count, 'unchanged_raw_values': len(attainable), 'unchanged_total_weight': sum(old_ids[k]['weight'] for k in unchanged),
    'max_raw_gain': max_raw_gain, 'max_raw_loss': min_raw_gain,
    'conditional_unrounded_bound': .6*max_raw_gain/49.5,
    'conditional_max_published_witness': max_conditional,
    'floor_unlock_max_abstract_witness': max_floor_unlock,
    'note': 'All-positive new functional outcomes remain 1. Added CSS/debounce/preservation legs may lower scores. A reachable mathematical state is not evidence that a candidate exhibits it.'}
write('functional-score-delta.json', score_evidence)
check('score_bound', max_raw_gain == 3.5 and max_conditional['delta'] <= .0425, score_evidence['conditional_max_published_witness'])

hashes = {p.relative_to(TASK).as_posix(): digest(p) for p in [*public, TASK / judge_path, TASK / 'tests/scored/functional/prompt.md', TASK / 'task.toml']}
result = {'scope': 'Fresh authored-contract/delta audit; browser outcomes require their separate actual witnesses, not these textual assertions.',
          'passed': all(c['passed'] for c in checks), 'check_count': len(checks), 'checks': checks,
          'baseline_archive_sha256': BASE_SHA, 'owned_source_sha256': hashes}
write('functional-contract-checks.json', result)
print(json.dumps({'passed': result['passed'], 'checks': len(checks), 'failed': [c for c in checks if not c['passed']],
                  'changed_existing': changed, 'added': added, 'unchanged': len(unchanged),
                  'conditional_max_published': max_conditional, 'floor_unlock_max': max_floor_unlock}, indent=2))
raise SystemExit(0 if result['passed'] else 1)
