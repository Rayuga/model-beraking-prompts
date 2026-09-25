from pathlib import Path
import importlib.util
import json
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ARCHIVE = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r10-static-repair-20260915/pellmoor-job-pipeline.zip'
spec = importlib.util.spec_from_file_location('upload_check', ROOT / 'references/task-templates/check-upload.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.audit(ARCHIVE)['passed']
OUT = HERE / 'negative-fixtures'
OUT.mkdir(exist_ok=True)
results = []
for dimension, value in [('render','0.0'),('constraints','0.0'),('render','-1.0'),('constraints','true'),('render','nan')]:
    archive = OUT / f'{dimension}-{value}-DO-NOT-SUBMIT.zip'
    name = f'pellmoor-job-pipeline/tests/{dimension}/judge.toml'
    with zipfile.ZipFile(ARCHIVE) as source, zipfile.ZipFile(archive,'w') as target:
        for entry in source.infolist():
            data = source.read(entry.filename)
            if entry.filename == name:
                changed = data.replace(b'weight = 1.0', ('weight = '+value).encode(), 1)
                assert changed != data
                data = changed
            target.writestr(entry,data)
    try:
        module.audit(archive)
    except AssertionError as error:
        assert str(error) == 'Platform requires finite positive judge weight '+dimension
        results.append({'dimension':dimension,'invalid_weight':value,'passed':True,'rejected_as':str(error)})
    else:
        raise AssertionError('Invalid judge weight accepted')
(HERE/'static-guard-results.json').write_text(json.dumps({'final_archive_passed':True,'results':results},indent=2)+'\n')
print('PASS valid archive and five invalid judge-weight regressions, including both reported zero weights')
