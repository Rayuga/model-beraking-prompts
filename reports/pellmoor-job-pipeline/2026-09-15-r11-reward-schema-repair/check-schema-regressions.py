from pathlib import Path
import importlib.util
import json
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
ARCHIVE=ROOT/'deliverables/pellmoor-job-pipeline/1.0.0-r11-reward-schema-repair-20260915/pellmoor-job-pipeline.zip'
spec=importlib.util.spec_from_file_location('upload_check',ROOT/'references/task-templates/check-upload.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.audit(ARCHIVE)['passed']
OUT=HERE/'negative-fixtures'
OUT.mkdir(exist_ok=True)
fixtures=[
    ('empty-reward-list','tests/reward.toml',lambda data:b'reward = []\n','Pellmoor platform requires nonempty [[reward]]'),
    ('missing-reward','tests/reward.toml',lambda data:data.split(b'[[reward]]')[0],'Pellmoor platform requires nonempty [[reward]]'),
    ('missing-name','tests/reward.toml',lambda data:data.replace(b'name = "reward"\n',b''),'Pellmoor canonical named reward and maps'),
    ('wrong-aggregation','tests/reward.toml',lambda data:data.replace(b'aggregation = "weighted_mean"',b'aggregation = "sum"'),'Pellmoor canonical named reward and maps'),
    ('render-zero','tests/render/judge.toml',lambda data:data.replace(b'weight = 1.0',b'weight = 0.0',1),'Platform requires finite positive judge weight render'),
    ('constraints-zero','tests/constraints/judge.toml',lambda data:data.replace(b'weight = 1.0',b'weight = 0.0',1),'Platform requires finite positive judge weight constraints'),
]
results=[]
for label,relative,mutate,expected in fixtures:
    archive=OUT/(label+'-DO-NOT-SUBMIT.zip')
    with zipfile.ZipFile(ARCHIVE) as source,zipfile.ZipFile(archive,'w') as target:
        for entry in source.infolist():
            data=source.read(entry.filename)
            if entry.filename=='pellmoor-job-pipeline/'+relative:
                altered=mutate(data)
                assert altered!=data
                data=altered
            target.writestr(entry,data)
    try:
        module.audit(archive)
    except AssertionError as error:
        assert str(error)==expected,(label,str(error))
        results.append({'case':label,'passed':True,'rejection':str(error)})
    else:
        raise AssertionError('Invalid package passed: '+label)
(HERE/'schema-regression-results.json').write_text(json.dumps({'final_archive_passed':True,'results':results},indent=2)+'\n')
print('PASS final archive and six schema regressions covering both reported static failures')
