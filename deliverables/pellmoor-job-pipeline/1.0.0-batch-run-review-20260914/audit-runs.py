import csv
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
RUNS = ROOT / 'run-outputs/pellmoor-job-pipeline'
PACKAGE = OUT.parent / '1.0.0-batch-offers-20260914'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


before = {p.relative_to(RUNS).as_posix(): digest(p) for p in RUNS.rglob('*') if p.is_file()}
manifest = read(PACKAGE / 'package-verification.json')
assert digest(PACKAGE / 'pellmoor-job-pipeline.zip') == manifest['zip_sha256']
with zipfile.ZipFile(PACKAGE / 'pellmoor-job-pipeline.zip') as archive:
    for name, expected in manifest['source_sha256'].items():
        assert hashlib.sha256(archive.read('pellmoor-job-pipeline/' + name)).hexdigest() == expected

trials = []
rows = []
for result_path in sorted(RUNS.glob('run-*/*/result.json')):
    result = read(result_path)
    trial = result_path.parent
    agent = result['config']['agent']
    model = agent.get('model_name') or agent['name']
    reward = read(trial / 'verifier/reward.json')
    assert reward == result['verifier_result']['rewards']
    calculated = 0.0 if reward['render'] <= 0 or reward['constraints'] <= 0 else round(.6 * reward['functional'] + .2 * reward['polish'] + .2 * reward['visual'], 4)
    assert calculated == reward['reward']
    assert float((trial / 'verifier/reward.txt').read_text()) == calculated
    provenance = read(trial / 'verifier/prompt-provenance.json')
    for dimension, info in provenance['judges'].items():
        for kind, filename in [('prompt', 'prompt.md'), ('judge', 'judge.toml')]:
            assert info[kind + '_sha256'] == manifest['source_sha256'][f'tests/{dimension}/{filename}']
    assert provenance['runner_sha256'] == manifest['source_sha256']['tests/test.sh']
    assert provenance['reward_config_sha256'] == manifest['source_sha256']['tests/reward.toml']
    details_path = trial / 'verifier/reward-details.json'
    dimensions = {}
    if details_path.exists():
        details = read(details_path)
        for dimension in ['render', 'constraints', 'functional', 'polish', 'visual']:
            item = details[dimension]
            criteria = item['criteria']
            assert len(criteria) == {'render': 2, 'constraints': 2, 'functional': 40, 'polish': 10, 'visual': 6}[dimension]
            assert len({c['id'] for c in criteria}) == len(criteria)
            earned = sum(c['value'] * c['weight'] for c in criteria)
            possible = sum(c['weight'] for c in criteria)
            assert round(earned / possible, 4) == reward[dimension] == item['score']
            dimensions[dimension] = {'full_credit': sum(c['value'] == 1 for c in criteria), 'count': len(criteria), 'earned': earned, 'possible': possible, 'judge_model': item['judge']['model'], 'deductions': [c for c in criteria if c['value'] < 1]}
            for criterion in criteria:
                rows.append({'model': model, 'dimension': dimension, **{k: criterion[k] for k in ['id', 'value', 'weight', 'reasoning']}})
    golden_matches = []
    if model == 'oracle':
        for name, expected in manifest['source_sha256'].items():
            if name.startswith('solution/'):
                deployed = trial / 'artifacts/app' / name.removeprefix('solution/')
                if deployed.is_file():
                    assert digest(deployed) == expected, name
                    golden_matches.append(name)
    trials.append({'model': model, 'trial': trial.relative_to(RUNS).as_posix(), 'task_checksum': result['task_checksum'], 'reward': reward, 'dimensions': dimensions, 'exception': result['exception_info'], 'provenance_matches': True, 'oracle_source_files_matched': golden_matches, 'agent_reasoning_effort': agent.get('kwargs', {}).get('reasoning_effort'), 'started_at': result['started_at'], 'finished_at': result['finished_at']})

gpt = next(RUNS.glob('run-728*/*/artifacts/app'))
witness = r'''
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = process.argv[1];
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const browser = fs.readFileSync(path.join(root, 'src/app.ts'), 'utf8');
const activity = server.slice(server.indexOf('function activityForVacancy('), server.indexOf('function activityForCandidate('));
const date = browser.slice(browser.indexOf('function timeLabel('), browser.indexOf('function scoreSummary(')).replace('iso: string', 'iso');
const ctx = {prepare: () => ({all: () => [{created_at: '2026-09-13T21:00:00.000Z', details_json: '{}'}]})};
vm.createContext(ctx);
vm.runInContext(activity + '\n' + date, ctx);
const result = vm.runInContext(`(() => {
  const row = activityForVacancy('ROLE-014')[0];
  let observed;
  try { timeLabel(row.createdAt); observed = 'unexpected success'; }
  catch (error) { observed = error.name + ': ' + error.message; }
  return {backendTimestampKey: 'created_at', frontendTimestampKey: 'createdAt', observed, positiveControl: timeLabel(row.created_at)};
})()`, ctx);
if (result.observed !== 'RangeError: Invalid time value') process.exit(1);
process.stdout.write(JSON.stringify(result));
'''
proc = subprocess.run(['node', '-e', witness, str(gpt)], capture_output=True, text=True, check=True)
source_witness = json.loads(proc.stdout)
source_witness['scope'] = 'Exact exported activity adapter and date formatter with a synthetic SQL row; not a browser rerun or rescore.'
assert len({t['task_checksum'] for t in trials}) == 1
after = {p.relative_to(RUNS).as_posix(): digest(p) for p in RUNS.rglob('*') if p.is_file()}
assert before == after
(OUT / 'run-review.json').write_text(json.dumps({'package_sha256': manifest['zip_sha256'], 'run_files_unchanged': len(before), 'trials': trials, 'gpt_source_witness': source_witness}, indent=2), encoding='utf-8')
(OUT / 'run-file-hashes.json').write_text(json.dumps(before, indent=2), encoding='utf-8')
(OUT / 'gpt-source-witness.json').write_text(json.dumps(source_witness, indent=2), encoding='utf-8')
with (OUT / 'criterion-results.csv').open('w', encoding='utf-8', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=['model', 'dimension', 'id', 'value', 'weight', 'reasoning'])
    writer.writeheader()
    writer.writerows(rows)
print(json.dumps({'trials': [{k: t[k] for k in ['model', 'reward', 'oracle_source_files_matched']} for t in trials], 'unaltered_run_files': len(before), 'criterion_rows': len(rows), 'gpt_source_witness': source_witness}, indent=2))
