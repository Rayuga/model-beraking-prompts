"""Read-only audit of the r17 ZIP against the supplied manual QC checklist."""
import hashlib
import json
from pathlib import Path
import random
import re
import tomllib
import types
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'projects/common-ground-ballot'
REFERENCE = ROOT / 'projects/bazaarbridge-marketplace-commerce'
DELIVERY = ROOT / 'deliverables/common-ground-ballot/2026-09-15-recovery-r17'
ARCHIVE = DELIVERY / 'common-ground-ballot.zip'
FROZEN = ROOT / 'reports/common-ground-ballot/2026-09-15-recovery-r17/frozen/common-ground-ballot'
DIMS = ['render', 'constraints', 'functional', 'polish', 'visual']
EXPECTED_SHA = '51465c839d05a23574b787ff7e4d01aeb3118c82cb138d8b3be875ab5d73c3a2'
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha(ARCHIVE.read_bytes()) == EXPECTED_SHA
with zipfile.ZipFile(ARCHIVE) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(set(archive.namelist())) == 39
    assert all(name.startswith('common-ground-ballot/') for name in archive.namelist())
    files = {name.split('/', 1)[1]: archive.read(name) for name in archive.namelist()}
assert files == {p.relative_to(SOURCE).as_posix(): p.read_bytes() for p in SOURCE.rglob('*') if p.is_file()}
assert files == {p.relative_to(FROZEN).as_posix(): p.read_bytes() for p in FROZEN.rglob('*') if p.is_file()}
parse = lambda data: tomllib.loads(data.decode('utf-8'))
task = parse(files['task.toml'])
reference = tomllib.loads((REFERENCE / 'task.toml').read_text(encoding='utf-8'))

def key_paths(value, prefix=''):
    paths = []
    for key, child in value.items():
        path = prefix + key
        paths.append(path)
        if isinstance(child, dict):
            paths.extend(key_paths(child, path + '.'))
    return sorted(paths)

assert key_paths(task) == key_paths(reference)
for key in ['schema_version', 'artifacts', 'agent', 'environment', 'verifier']:
    assert task[key] == reference[key], key
assert task['task']['version'] == reference['task']['version'] == '1.0.0'
checks = [{'point': '1.task.toml', 'status': 'pass', 'matching_key_paths': len(key_paths(task)),
           'missing_keys': [], 'extra_keys': [], 'operational_values_match': True,
           'version': task['task']['version'], 'verifier_env_matches_exactly': True,
           'timeouts': {'agent': task['agent']['timeout_sec'], 'build': task['environment']['build_timeout_sec'],
                        'verifier': task['verifier']['timeout_sec']}}]
key_pattern = re.compile(r'OPENAI_API_KEY|OPENROUTER_API_KEY|(?:openai|openrouter)[ _-]+api[ _-]+key|sk-(?:or-v1-|proj-)[A-Za-z0-9_-]{12,}', re.I)
for point, path in [('2.tests/Dockerfile', 'tests/Dockerfile'), ('3.tests/test.sh.key_restriction', 'tests/test.sh'),
                    ('4.environment/Dockerfile', 'environment/Dockerfile')]:
    text = files[path].decode('utf-8')
    assert not key_pattern.search(text), path
    assert b'\r\n' not in files[path], path
    checks.append({'point': point, 'status': 'pass', 'credential_mentions': 0, 'lf_endings': True})
docker = files['tests/Dockerfile'].decode('utf-8')
assert 'model_reasoning_effort = "max"' in docker
checks[1]['reasoning_effort'] = 'max'

judges = {dimension: parse(files[f'tests/{dimension}/judge.toml']) for dimension in DIMS}
assert {name.split('/')[1] for name in files if re.fullmatch(r'tests/[^/]+/judge.toml', name)} == set(DIMS)
timeouts = {}
for dimension, judge in judges.items():
    assert isinstance(judge['judge'], dict)
    assert 'judge' not in judge['judge'] and 'model' not in judge['judge']
    assert 'model' not in judge
    assert f'tests/{dimension}/prompt.md' in files
    reference_judge = tomllib.loads((REFERENCE / 'tests' / dimension / 'judge.toml').read_text(encoding='utf-8'))
    timeouts[dimension] = judge['judge']['timeout']
    assert timeouts[dimension] == reference_judge['judge']['timeout']
assert timeouts == dict(render=600, constraints=600, functional=9000, polish=900, visual=900)
wrapper = int(re.search(r'timeout (\d+) rewardkit --max-concurrent-agent 1', files['tests/test.sh'].decode('utf-8')).group(1))
assert sum(timeouts.values()) == 12000 < wrapper == 12600 < task['verifier']['timeout_sec']
checks.extend([
    {'point': '5.five_verifier_folders', 'status': 'pass', 'folders': DIMS, 'directory_spelling': 'tests/'},
    {'point': '6.five_judge_configurations', 'status': 'pass', 'banned_scalar_overrides': [],
     'required_judge_tables_present': 5, 'judge_timeouts': timeouts, 'wrapper_timeout': wrapper}])

module = types.ModuleType('audited_frozen_ballot_scorer')
exec(compile(files['tests/score.py'], 'frozen-r17/tests/score.py', 'exec'), module.__dict__)
test_vectors = [dict(render=r, constraints=c, functional=f, polish=p, visual=v)
    for r, c, f, p, v in [(1,1,1,1,1), (0,1,1,1,1), (1,0,1,1,1), (.001,.01,1,1,1),
                         (1,1,0,1,1), (1,1,.25,.75,.5), (1,1,.12345,.22222,.12311)]]
rng = random.Random(170915)
test_vectors.extend(dict(zip(DIMS, [rng.random() for _ in DIMS])) for _ in range(25))
score_rows = []
for data in test_vectors:
    expected = 0.0 if data['render'] <= 0 or data['constraints'] <= 0 else round(.6 * data['functional'] + .2 * data['polish'] + .2 * data['visual'], 4)
    observed = module.compose(dict(data), FROZEN / 'tests')
    assert observed == expected, (data, observed, expected)
    score_rows.append({'input': data, 'expected': expected, 'actual': observed, 'passed': True})
for bad in [None, True, '0.5', float('nan'), float('inf'), -0.1, 1.1]:
    data = dict.fromkeys(DIMS, 1.0)
    data['functional'] = bad
    try:
        module.compose(data, FROZEN / 'tests')
    except ValueError:
        pass
    else:
        raise AssertionError(f'Invalid score accepted: {bad!r}')
assert 'python3 /tests/score.py' in files['tests/test.sh'].decode('utf-8')
checks.append({'point': '3.reward_formula', 'status': 'behavior_matches_reference',
    'formula': '0 when render <= 0 or constraints <= 0; otherwise round(0.6*functional + 0.2*polish + 0.2*visual, 4)',
    'passing_numeric_cases': len(score_rows), 'malformed_scores_rejected': 7,
    'inline_in_test_sh': False, 'actual_location': 'tests/score.py, called by tests/test.sh',
    'literal_placement': 'Needs interpretation if the manual reviewer requires the literal block inside test.sh',
    'reference_also_rounds_to_four_decimals': 'reward = round(reward, 4)' in (REFERENCE / 'tests/test.sh').read_text(encoding='utf-8')})

functional = {criterion['id']: criterion for criterion in judges['functional']['criterion']}
old = json.loads((DELIVERY / 'input-run-audit.json').read_text(encoding='utf-8'))
existing_run = ROOT / old['run_directory']
details = json.loads((existing_run / 'verifier/reward-details.json').read_text(encoding='utf-8'))
old_verdicts = json.loads(details['functional']['judge_output'])
paid_weight = sum(c['weight'] for c in functional.values())
unchanged = sum(c['weight'] for cid, c in functional.items() if old_verdicts.get(cid, {}).get('score') == 'yes')
corrected = unchanged + functional['roster_conflict_snapshot_chain']['weight']
for cid in ['ballot_target_and_revision_validation', 'membership_input_validation']:
    assert old_verdicts[cid]['score'] == 'yes'
    corrected -= functional[cid]['weight']
assert old_verdicts['draft_input_validation']['score'] == 'no'
polish = {c['id']: c for c in judges['polish']['criterion']}
polish_total = sum(c['weight'] for c in polish.values())
restored_polish = 1 - polish['responsive_workspace_navigation']['weight'] / polish_total
counterfactual = {'assumption': 'Existing app; all six additions fail, restore missing roster/participation evidence, retain actual mobile overflow, apply demonstrated malformed-input failures',
    'functional_numerator': corrected, 'functional_denominator': paid_weight,
    'functional': round(corrected / paid_weight, 4), 'polish': round(restored_polish, 4), 'visual': 1,
    'overall': round(.6 * corrected / paid_weight + .2 * restored_polish + .2, 4), 'fresh_model_score': False}
report = {'archive': str(ARCHIVE.relative_to(ROOT)), 'sha256': EXPECTED_SHA, 'files': len(files),
    'source_frozen_archive_match': True, 'reference_directory': str(REFERENCE.relative_to(ROOT)),
    'reference_task_sha256': sha((REFERENCE / 'task.toml').read_bytes()),
    'reference_provenance': 'Designated canonical extracted workspace reference. Jordan original ZIP bytes not available for independent comparison.',
    'checks': checks, 'scoring_vectors': score_rows, 'difficulty_counterfactual': counterfactual,
    'recommendation': 'Substantial coherent complexity; retain current scope and run fresh Oracle/GPT before further expansion.',
    'fresh_platform_qc': False, 'fresh_oracle': False, 'fresh_gpt': False, 'task_modified': False}
(OUT / 'manual-qc-audit.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
assert sha(ARCHIVE.read_bytes()) == EXPECTED_SHA
print(json.dumps({key: value for key, value in report.items() if key != 'scoring_vectors'}, indent=2))
