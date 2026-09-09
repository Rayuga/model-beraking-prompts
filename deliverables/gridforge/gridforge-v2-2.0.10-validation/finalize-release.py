"""Record the agent TLS fix without changing grader or golden-app behavior."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

out = Path(__file__).resolve().parent
root = next(p for p in out.parents if (p / 'projects/gridforge-spreadsheet-v2/task.toml').is_file())
task = root / 'projects/gridforge-spreadsheet-v2'
old = out.parent / 'gridforge-v2-2.0.9-validation/gridforge-spreadsheet-v2.zip'
audit = json.loads((out / 'structural-checks.json').read_text())['gridforge-spreadsheet-v2']
assert all(c['passed'] for c in audit['checks'])
allowed = {'task.toml', 'environment/Dockerfile', 'tests/Dockerfile',
           'solution/app/package.json', 'solution/app/package-lock.json'}
with zipfile.ZipFile(old) as archive:
    changed = []
    for item in archive.namelist():
        relative = item.split('/', 1)[1]
        if archive.read(item) != (task / relative).read_bytes():
            changed.append(relative)
    assert set(changed) == allowed, changed
    for file in ('package.json', 'package-lock.json'):
        previous = json.loads(archive.read('gridforge-spreadsheet-v2/solution/app/' + file))
        current = json.loads((task / 'solution/app' / file).read_text())
        current['version'] = previous['version']
        if file == 'package-lock.json':
            current['packages']['']['version'] = previous['packages']['']['version']
        assert current == previous, 'Dependency drift in ' + file

archive = out / audit['archive']['file']
if not archive.exists():
    archive = out / 'gridforge-spreadsheet-v2.zip'
destination = out / 'gridforge-spreadsheet-v2.zip'
if archive != destination:
    shutil.copyfile(archive, destination)
with zipfile.ZipFile(destination) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == 32
    assert {n.split('/')[0] for n in z.namelist()} == {'gridforge-spreadsheet-v2'}

report = {
    'version': '2.0.10', 'run': 'run-ce624351',
    'diagnosis': 'OpenHands SDK installation failed before agent execution: curl exit 77, missing /etc/ssl/certs/ca-certificates.crt.',
    'run_model': 'gemini/gemini-3.7-flash', 'run_agent': 'openhands-sdk 1.44.1',
    'agent_executed': False, 'verifier_executed': False, 'measured_score': None,
    'fix': 'Install ca-certificates in the agent Dockerfile, regenerate the trust store, and assert the bundle exists during the image build.',
    'validation': {
        'old_agent_image_missing_ca_bundle': True,
        'new_agent_image_build': 'passed',
        'secure_get_exact_failed_bootstrap_url_http_status': 200,
        'certificate_verification_disabled': False,
        'installer_executed': False,
        'structural_checks_passed': 34,
        'golden_implementation_and_verifier_criteria_unchanged': True,
        'dependency_metadata_unchanged_except_root_release_version': True,
        'platform_retry': 'not started',
        'oracle': 'not rerun for this infrastructure-only fix',
    },
    'network': {'agent': 'public', 'verifier': 'public'},
    'changed_files_since_2.0.9': sorted(changed),
    'zip': {'path': destination.name, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'files': 32},
}
(out / 'bootstrap-fix-report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
