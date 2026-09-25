import importlib.util
import json
from pathlib import Path
import zipfile

here = Path(__file__).resolve().parent
root = here.parents[2]
archive = root / 'deliverables/pellmoor-job-pipeline/1.0.0-r9-qc-repair-20260915/pellmoor-job-pipeline.zip'
spec = importlib.util.spec_from_file_location('upload_audit', root / 'references/task-templates/check-upload.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.audit(archive)['passed']
out = here / 'qc-negative-fixtures'
out.mkdir(exist_ok=True)
results = []
fixtures = [
    ('verifier-seed-drift', 'tests/pellmoor_seed_data.json', lambda data: data.replace(b'Devi Ranjit', b'Devi Changed'), 'Pellmoor generated verifier seed matches canonical input'),
    ('environment-seed-drift', 'environment/assets/recruitment/records/pellmoor_seed_data.json', lambda data: data.replace(b'Devi Ranjit', b'Devi Changed'), 'Pellmoor generated verifier seed matches canonical input'),
    ('render-weight-drift', 'tests/render/judge.toml', lambda data: data.replace(b'weight = 0.0', b'weight = 1.0', 1), 'Pellmoor judge weight matches reward config render'),
    ('constraints-weight-drift', 'tests/constraints/judge.toml', lambda data: data.replace(b'weight = 0.0', b'weight = 1.0', 1), 'Pellmoor judge weight matches reward config constraints'),
]
for name, relative, mutation, expected in fixtures:
    target = out / (name + '-DO-NOT-SUBMIT.zip')
    with zipfile.ZipFile(archive) as source, zipfile.ZipFile(target, 'w') as destination:
        changed = False
        for info in source.infolist():
            data = source.read(info.filename)
            if info.filename == 'pellmoor-job-pipeline/' + relative:
                modified = mutation(data)
                assert modified != data
                data, changed = modified, True
            destination.writestr(info, data)
        assert changed
    try:
        module.audit(target)
    except AssertionError as error:
        assert str(error) == expected, str(error)
        results.append({'case': name, 'passed': True, 'rejection': str(error)})
    else:
        raise AssertionError('Bad fixture unexpectedly passed: ' + name)
(here / 'packaging-guard-results.json').write_text(json.dumps({'final_archive_passed': True, 'results': results}, indent=2) + '\n')
print('PASS final archive and four negative seed/weight divergence cases')
