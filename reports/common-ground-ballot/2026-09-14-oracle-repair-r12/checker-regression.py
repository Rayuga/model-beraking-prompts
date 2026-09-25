import importlib.util
import json
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = ROOT / 'deliverables/common-ground-ballot/2026-09-14-functional-r11/common-ground-ballot.zip'
spec = importlib.util.spec_from_file_location('checker', ROOT / 'references/task-templates/check-upload.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
results = []
with zipfile.ZipFile(BASE) as source:
    original = [(info, source.read(info)) for info in source.infolist()]


def run(name, change, expected_failure=None):
    with tempfile.TemporaryDirectory() as folder:
        archive = Path(folder) / 'candidate.zip'
        with zipfile.ZipFile(archive, 'w') as target:
            for original_info, original_data in original:
                info = zipfile.ZipInfo(original_info.filename, original_info.date_time)
                info.create_system = original_info.create_system
                info.external_attr = original_info.external_attr
                data = change(info, original_data)
                if data is not None:
                    target.writestr(info, data)
        try:
            result = checker.audit(archive)
        except AssertionError as error:
            assert expected_failure and expected_failure in str(error), (name, str(error))
            results.append({'name':name,'passed':True,'rejected':str(error)})
        else:
            assert expected_failure is None, name
            results.append({'name':name,'passed':True,'archive_checks':len(result['checks'])})


def replace(path, old, new):
    def change(info, data):
        if info.filename == 'common-ground-ballot/' + path:
            assert old.encode() in data
            return data.replace(old.encode(), new.encode())
        return data
    return change


run('r11 equivalent independent wording and canonical aggregation', lambda info,data:data)
run('Windows Markdown line endings',lambda info,data:data.replace(b'\n',b'\r\n') if info.filename.endswith('/functional/prompt.md') else data)
run('missing independent scoring', replace('tests/render/prompt.md','Independent criterion scoring:','Scoring:'),'Independent judgments')
run('missing continuation', replace('tests/render/prompt.md','Continue after individual failures','Stop after individual failures'),'Independent judgments')
run('missing gate', replace('tests/render/prompt.md','Global browser gate:','Gate:'),'Shared prerequisite section')
run('changed gate in one dimension', replace('tests/render/prompt.md','CommonGround!wrong','AnotherWrongPassword'),'Identical global prerequisite')
run('noncanonical render all-pass aggregation', replace('tests/render/judge.toml','aggregation = "weighted_mean"','aggregation = "all_pass"'),'Correct dimension aggregation')
run('noncanonical constraints all-pass aggregation', replace('tests/constraints/judge.toml','aggregation = "weighted_mean"','aggregation = "all_pass"'),'Correct dimension aggregation')
run('missing provided seed',lambda info,data:None if info.filename=='common-ground-ballot/environment/assets/artifacts/common_ground_seed.json' else data,'Referenced provided path exists')


def nonexecutable(info,data):
    if info.filename.endswith('/solution/solve.sh'):
        info.external_attr=0o100644<<16
    return data


run('nonexecutable solve script',nonexecutable,'Executable LF shell script')
run('zero criterion weight',replace('tests/render/judge.toml','weight = 1.0','weight = 0.0'),'Finite positive criterion weight')
(OUT/'checker-regression.json').write_text(json.dumps({'results':results},indent=2)+'\n',encoding='utf-8')
print('PASS',len(results),'checker regression cases')
