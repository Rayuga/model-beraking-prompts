"""Package the readiness fix without overwriting previous QC evidence."""
import hashlib
import json
from pathlib import Path
import shutil
import tomllib
import zipfile

out = Path(__file__).resolve().parent
root = next(p for p in out.parents if (p / 'projects/gridforge-spreadsheet-v2/task.toml').is_file())
task = root / 'projects/gridforge-spreadsheet-v2'
structural = json.loads((out / 'structural-checks.json').read_text())['gridforge-spreadsheet-v2']
local = json.loads((out / 'local-validation.json').read_text())
readiness = json.loads((out / 'readiness-regression.json').read_text())
lockfile = json.loads((out / 'lockfile-validation.json').read_text())
assert lockfile['npm_ci'] == 'passed'
assert all(c['passed'] for c in structural['checks'])
assert local['status'] == 'passed' and all(c['passed'] for c in readiness['results'])
archive = out / structural['archive']['file']
if not archive.exists():
    archive = out / 'gridforge-spreadsheet-v2.zip'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist()) == 32
    assert {p.split('/')[0] for p in z.namelist()} == {'gridforge-spreadsheet-v2'}
    for p, digest in structural['source_sha256'].items():
        data = (task / p).read_bytes()
        assert hashlib.sha256(data).hexdigest() == digest
        assert z.read('gridforge-spreadsheet-v2/' + p) == data
    config = tomllib.loads(z.read('gridforge-spreadsheet-v2/task.toml').decode())
    assert config['environment']['network_mode'] == config['verifier']['environment']['network_mode'] == 'public'

old = out.parent / 'gridforge-v2-2.0.8-validation/gridforge-spreadsheet-v2.zip'
with zipfile.ZipFile(old) as z:
    for dimension in ('render', 'constraints', 'functional', 'polish'):
        p = f'tests/{dimension}/judge.toml'
        assert tomllib.loads(z.read('gridforge-spreadsheet-v2/' + p).decode()) == tomllib.loads((task / p).read_text(encoding='utf-8'))
    for p in ['public/js/app.js', 'public/index.html', 'public/styles.css', 'src/index.js', 'src/db.js']:
        assert z.read('gridforge-spreadsheet-v2/solution/app/' + p) == (task / 'solution/app' / p).read_bytes()

destination = out / 'gridforge-spreadsheet-v2.zip'
if archive != destination:
    shutil.copyfile(archive, destination)
groups = len(local['smoke']['passed']) + sum(len(local[k]['results']) for k in
    ('previous_oracle_failures', 'interaction_regression', 'collaboration_regression'))
report = {
    'version': '2.0.9', 'scope': 'Readiness-gate fix; not a platform QC or Oracle grade',
    'change': 'Explicit bounded HTTP readiness wait in test.sh before RewardKit; curl installed in verifier image.',
    'lockfile_fix': 'Restored dependency metadata altered by earlier release-version replacement; only the root package version is 2.0.9.',
    'lockfile_validation': lockfile,
    'network': {'agent': 'public', 'verifier': 'public'},
    'criteria': local['criteria'], 'criteria_and_weights_unchanged': True,
    'golden_implementation_unchanged': True,
    'structural_checks_passed': len(structural['checks']),
    'browser_regression_groups_passed': groups, 'readiness': readiness,
    'historical_evidence': 'Version 2.0.8 archives and reports preserved unchanged.',
    'platform_check_status': 'Requires re-upload; check-verifier-contract.py is not available locally.',
    'oracle_status': 'Not run; user will run on platform.',
    'zip': {'file': destination.name, 'files': 32, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
}
(out / 'qc-preflight.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
