from pathlib import Path
import importlib.util,json,zipfile

out=Path(__file__).resolve().parent
root=out.parents[2]
spec=importlib.util.spec_from_file_location('upload',root/'references/task-templates/check-upload.py')
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
source=out/'gambit-hollow-cribbage.zip'
target=out/'aggregation-fixtures'
target.mkdir(exist_ok=True)
cases=[('preserved-gates',{},True),('reference-weighted-gates',{'render':('all_pass','weighted_mean'),'constraints':('all_pass','weighted_mean')},True),('invalid-functional',{'functional':('weighted_mean','all_pass')},False),('invalid-visual',{'visual':('weighted_mean','all_pass')},False)]
results=[]
for name,changes,want in cases:
    path=target/(name+'.zip')
    with zipfile.ZipFile(source) as src,zipfile.ZipFile(path,'w') as dst:
        for item in src.infolist():
            data=src.read(item.filename)
            for dim,(old,new) in changes.items():
                if item.filename.endswith(f'tests/{dim}/judge.toml'):
                    data=data.replace(f'aggregation = "{old}"'.encode(),f'aggregation = "{new}"'.encode())
            dst.writestr(item,data)
    reason=None
    try:
        audit.audit(path)
        passed=True
    except AssertionError as exc:
        reason=str(exc)
        passed=False
    assert passed==want,(name,reason)
    if not want:assert reason=='Correct dimension aggregation '+next(iter(changes)),reason
    results.append({'case':name,'accepted':passed,'expected':want,'reason':reason})
(out/'aggregation-results.json').write_text(json.dumps(results,indent=2)+'\n')
print('PASS aggregation regression: both gate policies accepted; functional/visual all_pass rejected')
