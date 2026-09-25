import importlib.util
import copy
import json
from pathlib import Path
import re
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
archive=ROOT/'deliverables/common-ground-ballot/2026-09-15-coverage-r16/common-ground-ballot.zip'
spec=importlib.util.spec_from_file_location('upload',ROOT/'references/task-templates/check-upload.py')
checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
names={'functional':['observer_ballot_setup_access','observer_published_results_access','observer_members_access','observer_audit_access'],
       'polish':['status_text_without_color','unavailable_action_guidance']}
results=[]
with zipfile.ZipFile(archive) as original, tempfile.TemporaryDirectory(prefix='ballot-r16-') as tmp:
    for dimension,ids in names.items():
        for cid in ids:
            target=f'common-ground-ballot/tests/{dimension}/judge.toml'
            text=original.read(target).decode('utf-8')
            pattern=r'\[\[criterion\]\]\s*id = "'+re.escape(cid)+r'".*?(?=\[\[criterion\]\]|\Z)'
            changed,count=re.subn(pattern,'',text,flags=re.S)
            assert count==1
            mutant=Path(tmp)/(cid+'.zip')
            with zipfile.ZipFile(mutant,'w') as z:
                for info in original.infolist():
                    z.writestr(copy.copy(info),changed.encode('utf-8') if info.filename==target else original.read(info))
            try:
                checker.audit(mutant)
            except AssertionError as error:
                message=str(error)
                assert message in ('Observer positive read coverage','Independent theme touch and motion criteria'),message
                results.append({'removed':cid,'rejected_by':message,'passed':True})
            else:
                raise AssertionError('Missing criterion was accepted: '+cid)
(OUT/'preflight-regressions.json').write_text(json.dumps({'results':results},indent=2)+'\n',encoding='utf-8')
print('PASS all six missing-coverage archive variants rejected')
