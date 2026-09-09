"""Verify the packaged source and record measured local release evidence."""
from pathlib import Path
import hashlib
import json
import shutil
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = next(p for p in OUT.parents if (p / 'projects/gridforge-spreadsheet-v2/task.toml').is_file())
TASK = ROOT / 'projects/gridforge-spreadsheet-v2'
config = tomllib.loads((TASK / 'task.toml').read_text(encoding='utf-8'))
structural = json.loads((OUT / 'structural-checks.json').read_text())['gridforge-spreadsheet-v2']
local = json.loads((OUT / 'local-validation.json').read_text())
assert local['status'] == 'passed'
assert all(check['passed'] for check in structural['checks'])
assert config['environment']['network_mode'] == config['verifier']['environment']['network_mode'] == 'public'
archive = OUT / structural['archive']['file']
if not archive.exists():
    archive = OUT / 'gridforge-spreadsheet-v2.zip'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert {n.split('/')[0] for n in z.namelist()} == {'gridforge-spreadsheet-v2'}
    for path, expected in structural['source_sha256'].items():
        data = (TASK / path).read_bytes()
        assert hashlib.sha256(data).hexdigest() == expected, path
        assert z.read('gridforge-spreadsheet-v2/' + path) == data, path
    assert len(z.namelist()) == len(structural['source_sha256']) == 32

delivery = OUT / 'gridforge-spreadsheet-v2.zip'
if archive != delivery:
    shutil.copyfile(archive, delivery)
groups = len(local['smoke']['passed'])
for key in ('previous_oracle_failures', 'interaction_regression', 'collaboration_regression'):
    assert all(r['passed'] for r in local[key]['results'])
    assert local[key]['errors'] == []
    groups += len(local[key]['results'])

report = {
    'task': config['task']['name'], 'version': config['task']['version'],
    'status': 'Prepared for platform QC and Oracle, not Oracle-certified',
    'networks': {'agent': 'public', 'verifier': 'public', 'separate_verifier': True},
    'criteria': local['criteria'], 'total_criteria': sum(local['criteria'].values()),
    'local_structural_checks_passed': len(structural['checks']),
    'local_browser_regression_groups_passed': groups,
    'local_noop_reward': local['empty_submission']['reward'],
    'current_full_oracle': 'Not run; user will run on platform',
    'current_platform_qc': 'Not run; prior QC evidence retained unchanged',
    'historical_oracle': {'run': 'run-44b1f2a8', 'reward': 0.8973, 'applies_to_current_source': False},
    'changes_this_preparation': [
        'No changes to task requirements, golden source, criteria or weights after the merge.',
        'Added local regression evidence and a task-scoped packaging option.',
        'Corrected a local test coordinate-read race; no extra mouse gestures or app repair used.'
    ],
    'validation_limits': [
        'Local regression groups are not a complete 44-criterion Codex/Luna judgment.',
        'Polish scores and complete judge journeys require the platform run.',
        'Disposable local tests used network none; shipped task agent and verifier are public.'
    ],
    'archive': {'file': delivery.name, 'files': 32, 'bytes': delivery.stat().st_size,
                'sha256': hashlib.sha256(delivery.read_bytes()).hexdigest()},
    'source_sha256': structural['source_sha256']
}
(OUT / 'qc-preflight.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k:v for k,v in report.items() if k != 'source_sha256'}, indent=2))
