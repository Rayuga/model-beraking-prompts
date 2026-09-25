import csv
import hashlib
import json
from pathlib import Path
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
RUNS = ROOT / 'run-outputs/pellmoor-job-pipeline'
LATEST = OUT.parent / '1.0.0-evidence-reliability-20260914'
SOURCE = ROOT / 'projects/pellmoor-job-pipeline'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

old_hashes = read(LATEST / 'run-file-hashes.json')
manifest = read(LATEST / 'package-verification.json')
zip_path = LATEST / 'pellmoor-job-pipeline.zip'
assert digest(zip_path) == manifest['zip_sha256']
assert all(digest(SOURCE / name) == expected for name, expected in manifest['source_sha256'].items())
with zipfile.ZipFile(zip_path) as archive:
    assert archive.testzip() is None
    names = [n for n in archive.namelist() if not n.endswith('/')]
    assert len(names) == 34
    assert all(archive.read('pellmoor-job-pipeline/' + name) == (SOURCE / name).read_bytes() for name in manifest['source_sha256'])

review = {'date': '2026-09-14', 'recommended_zip': str(zip_path.relative_to(ROOT)), 'recommended_zip_sha256': digest(zip_path), 'recommended_functional_revision': 'r7', 'source_and_zip_unchanged': True, 'fresh_r7_platform_results_present': False, 'runs': [], 'historical_trial_comparison': {}}
rows = []
for path in sorted(RUNS.glob('*/*/result.json')):
    trial = read(path)
    verifier = path.parent / 'verifier'
    if not (verifier / 'reward.json').exists():
        continue
    reward = read(verifier / 'reward.json')
    details = read(verifier / 'reward-details.json') if (verifier / 'reward-details.json').exists() else {}
    provenance = read(verifier / 'prompt-provenance.json') if (verifier / 'prompt-provenance.json').exists() else {}
    agent = trial['config']['agent']
    entry = {'trial': trial['trial_name'], 'model': agent.get('model_name') or agent['name'], 'agent': agent['name'], 'solver_effort': agent.get('kwargs', {}).get('reasoning_effort'), 'task_checksum': trial['task_checksum'], 'reward': reward, 'exception_info': trial.get('exception_info'), 'provenance': provenance, 'dimensions': {}}
    for dimension, result in details.items():
        criteria = result.get('criteria', [])
        entry['dimensions'][dimension] = {'score': result['score'], 'full_credit': sum(c['value'] == 1 for c in criteria), 'count': len(criteria), 'criteria': criteria}
        for c in criteria:
            rows.append({'trial': trial['trial_name'], 'model': entry['model'], 'dimension': dimension, **{key: c[key] for key in ['id', 'value', 'raw', 'weight', 'reasoning']}})
    if 'functional' in details:
        expected = round(.6 * details['functional']['score'] + .2 * details['polish']['score'] + .2 * details['visual']['score'], 4) if details['render']['score'] > 0 and details['constraints']['score'] > 0 else 0
        assert abs(expected - reward['reward']) < .00011
    review['runs'].append(entry)
for term in ['Qc2r8HT', 'Paz2bhd', 'nKzERuD']:
    entries = {key: value for key, value in old_hashes.items() if term in key}
    matches = [key for key, value in entries.items() if (RUNS / key).is_file() and digest(RUNS / key) == value]
    review['historical_trial_comparison'][term] = {'previous_files': len(entries), 'identical_files': len(matches), 'all_identical': len(entries) == len(matches)}
    assert len(entries) == len(matches)
review['local_browser_diagnostic'] = read(OUT / 'gpt-browser-probe.json')
assert review['local_browser_diagnostic']['passed']
review['previous_unchanged_golden_validation'] = read(LATEST / 'batch-regressions.json')
review['previous_validation_limits'] = ['11 local golden workflow groups passed; this is not a platform Oracle score', 'Exact image builds were blocked by dependency-network failures', 'Inherited generic upload checker fails an exact-wording assertion: Independent judgments render']
(OUT / 'run-review.json').write_text(json.dumps(review, indent=2) + '\n', encoding='utf-8')
with (OUT / 'criterion-results.csv').open('w', newline='', encoding='utf-8') as handle:
    writer = csv.DictWriter(handle, fieldnames=['trial', 'model', 'dimension', 'id', 'value', 'raw', 'weight', 'reasoning'])
    writer.writeheader()
    writer.writerows(rows)
current_hashes = {str(p.relative_to(RUNS)): digest(p) for p in sorted(RUNS.rglob('*')) if p.is_file()}
(OUT / 'run-file-hashes.json').write_text(json.dumps(current_hashes, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'trials': len(review['runs']), 'criterion_rows': len(rows), 'preserved_run_files': len(current_hashes), 'oracle_identical': review['historical_trial_comparison']['Qc2r8HT'], 'zip_sha256': digest(zip_path)}))
