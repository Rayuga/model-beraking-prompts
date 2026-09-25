"""Audit supplied platform verdicts without changing task or golden files."""
from datetime import datetime
import hashlib
import json
from pathlib import Path
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
DELIVERY = ROOT / 'deliverables/common-ground-ballot/2026-09-15-recovery-r17'
ARCHIVE = DELIVERY / 'common-ground-ballot.zip'
ORACLE = ROOT / 'run-outputs/common-ground-ballot/run-7cc29c66-a32f-4a7a-bb93-bea23993c795/common-ground-ballot__PoFcosA'
NOP = ORACLE.parent / 'common-ground-ballot__pyc8oFk'
MODEL = ROOT / 'run-outputs/common-ground-ballot/run-da46d1e1-1f11-4019-8af8-2e2c9ff64cba/common-ground-ballot__iK9n9ye'
DIMS = ['render', 'constraints', 'functional', 'polish', 'visual']
read = lambda path: json.loads(path.read_text(encoding='utf-8'))
sha = lambda data: hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(ARCHIVE) as archive:
    assert archive.testzip() is None
    files = {name.split('/', 1)[1]: archive.read(name) for name in archive.namelist()}
judges = {dimension: tomllib.loads(files[f'tests/{dimension}/judge.toml'].decode('utf-8')) for dimension in DIMS}
source_matches = {}
for name in ['server.js', 'package.json', 'public/app.js', 'public/index.html', 'public/styles.css']:
    actual = (ORACLE / 'artifacts/app' / name).read_bytes()
    assert actual == files['solution/' + name], name
    source_matches[name] = sha(actual)
assert (ORACLE / 'artifacts/app/common_ground_seed.json').read_bytes() == files['environment/assets/artifacts/common_ground_seed.json']

def verify_provenance(trial):
    provenance = read(trial / 'verifier/prompt-provenance.json')
    matches = {}
    for dimension in DIMS:
        for name, key in [('prompt.md', 'prompt_sha256'), ('judge.toml', 'judge_sha256')]:
            path = f'tests/{dimension}/{name}'
            assert provenance['judges'][dimension][key] == sha(files[path]), path
            matches[path] = True
    for name, key in [('test.sh', 'runner_sha256'), ('score.py', 'score_sha256'), ('reward.toml', 'reward_sha256')]:
        assert provenance[key] == sha(files['tests/' + name])
        matches['tests/' + name] = True
    assert provenance['resource_sha256']['functional/recovery.md'] == sha(files['tests/functional/recovery.md'])
    matches['tests/functional/recovery.md'] = True
    return matches

def elapsed(start, end):
    return round((datetime.fromisoformat(end.replace('Z', '+00:00')) - datetime.fromisoformat(start.replace('Z', '+00:00'))).total_seconds(), 3)

trials = {}
for label, trial in [('oracle', ORACLE), ('nop', NOP), ('haiku', MODEL)]:
    result = read(trial / 'result.json')
    reward = read(trial / 'verifier/reward.json')
    matching = verify_provenance(trial)
    trials[label] = {'path': str(trial.relative_to(ROOT)), 'agent': result['config']['agent']['name'],
        'model': result['config']['agent'].get('model_name'), 'scores': reward,
        'trial_elapsed_seconds': elapsed(result['started_at'], result['finished_at']),
        'verifier_elapsed_seconds': elapsed(result['verifier']['started_at'], result['verifier']['finished_at']),
        'exception': result.get('exception_info'), 'provenance_matches': matching}

details = read(ORACLE / 'verifier/reward-details.json')
verdicts = json.loads(details['functional']['judge_output'])
weights = {criterion['id']: criterion['weight'] for criterion in judges['functional']['criterion']}
failed = []
for cid, verdict in verdicts.items():
    if verdict['score'] == 'yes':
        continue
    classification = ('recovery_work_not_completed' if cid in ['durable_pending_staff_work', 'immutable_pending_retry',
        'independent_pending_actions', 'pending_actor_isolation', 'cross_tab_pending_resolution'] else
        'reported_automation_crash' if cid == 'roster_conflict_snapshot_chain' else
        'missing_checkpoint' if cid == 'staff_identified_turnout' else
        'wrong_probe_shape_or_state' if cid == 'stale_ballot_revision_refusal' else 'unverified_application_allegation')
    failed.append({'id': cid, 'weight': weights[cid], 'classification': classification, 'reason': verdict['reasoning']})
assert len(failed) == 9
lost = sum(row['weight'] for row in failed)
assert lost == 24 and sum(weights.values()) == 58
assert round((58 - lost) / 58, 4) == trials['oracle']['scores']['functional']
assert round(.6 * trials['oracle']['scores']['functional'] + .2 * trials['oracle']['scores']['polish'] + .2 * trials['oracle']['scores']['visual'], 4) == trials['oracle']['scores']['reward']
prior_boundary = read(DELIVERY / 'golden-strict-boundaries-results.json')
old_missing = next(row for row in prior_boundary['checks'] if row['name'] == 'edit: missing revision refused without mutation')
assert old_missing['passed'] and old_missing['response']['status'] == 400 and old_missing['businessStateUnchanged']
assert 'expected_revision' not in old_missing['request']['body']
fresh_mcp = read(OUT / 'mcp-reproduction/mcp-recovery-reproduction-results.json')
assert fresh_mcp['passed'] == 3 and fresh_mcp['failed'] == 0
assert fresh_mcp['mcpVersion'] == '0.0.79' and fresh_mcp['actualExportedOracleApp']
assert not fresh_mcp['scoredOracle']
copied_hashes = read(OUT / 'mcp-reproduction/copied-app-hashes.json')
assert all(copied_hashes[name] == digest for name, digest in source_matches.items())
report = {'archive_sha256': sha(ARCHIVE.read_bytes()), 'file_count': len(files),
    'verifier_dimensions': len(DIMS), 'criterion_counts': {dimension: len(judges[dimension]['criterion']) for dimension in DIMS},
    'total_criteria': sum(len(judge['criterion']) for judge in judges.values()),
    'execution': 'Five browser-judge dimensions run serially; criteria within each dimension are batched into one judge task.',
    'trials': trials, 'oracle_export_matches_frozen_golden': source_matches,
    'oracle_failures': failed, 'functional_weight_total': 58, 'functional_weight_lost': lost,
    'recovery_weight_not_completed': 20, 'evidence_or_probe_failures_weight': 23.5,
    'application_allegation_weight': 0.5,
    'historical_missing_revision_probe': old_missing,
    'fresh_exported_app_mcp_reproduction': fresh_mcp,
    'fresh_reproduction_app_hashes_match': True,
    'runtime_limit_observation': 'Oracle completed graded=1 with no exception after about 41m18s of whole-verifier runtime; no timeout is recorded.',
    'per_dimension_elapsed_available': False, 'judge_trajectories_available': False,
    'evidence_limit': 'The export contains verdict reasons but no judge JSONL/ATIF trajectory, captured browser requests, scratch ledgers or screenshots. Exact automation exception and request blamed for 200 cannot be reconstructed. The fresh independent reproduction returned 400 as required.',
    'intermediate_reward_note': 'rewardkit.log 0.9172 is the intermediate weighted aggregate including positive gate weights. Final 0.7517 is the correctly composed 60/20/20 gated reward, not a scoring arithmetic bug.',
    'task_changed': False, 'recommendation': 'Do not rerun r17 unchanged; repair judge workflow reliability before another scored candidate.'}
(OUT / 'run-audit.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key not in ['historical_missing_revision_probe', 'oracle_export_matches_frozen_golden']}, indent=2))
