"""PatchPad-only evidence audit and ZIP export; no historical files are changed."""
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess
import tomllib
import zipfile

out=Path(__file__).resolve().parent
root=out.parents[2]
slug='patchpad-editor-v2'
task=root/'projects'/slug
sha=lambda data:hashlib.sha256(data).hexdigest()
previous=out.parent/'2.0.6-readiness/patchpad-editor-v2.zip'
assert sha(previous.read_bytes())=='327efa72fead8f10b71c90d5777bb980a685acbe058512b6d933af242730a144'
with zipfile.ZipFile(previous) as z:
    old={n.removeprefix(slug+'/'):z.read(n) for n in z.namelist()}
files={p.relative_to(task).as_posix():p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert set(files)==set(old) and len(files)==30
for name,data in files.items():
    assert not data.startswith(b'\xef\xbb\xbf') and b'\r' not in data,name
    assert not re.search(rb'sk-or-v1-[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----',data)
    if name.endswith('.json'):json.loads(data)
    if name.endswith('.toml'):tomllib.loads(data.decode())
    if name not in ('tests/functional/judge.toml','tests/functional/prompt.md'):
        assert data==old[name].replace(b'2.0.6',b'2.0.7'),name
config=tomllib.loads(files['task.toml'].decode())
assert config['task']['version']=='2.0.7'
assert config['environment']['network_mode']==config['verifier']['environment']['network_mode']=='public'
assert config['verifier']['environment_mode']=='separate'
changed=[];counts={};judges={}
for dimension in ('render','constraints','functional','polish'):
    name=f'tests/{dimension}/judge.toml'
    current=tomllib.loads(files[name].decode());before=tomllib.loads(old[name].decode())
    assert current['judge']==before['judge']
    assert len(current['criterion'])==len(before['criterion'])
    for criterion,prior in zip(current['criterion'],before['criterion']):
        assert {k:v for k,v in criterion.items() if k!='description'}=={k:v for k,v in prior.items() if k!='description'}
        if criterion['description']!=prior['description']:
            assert criterion['description'].startswith(prior['description'].rstrip())
            changed.append(criterion['id'])
    counts[dimension]=len(current['criterion']);judges[dimension]=current
    assert f'v2.0.7' in files[name].splitlines()[0].decode()
    assert f'v2.0.7' in files[f'tests/{dimension}/prompt.md'].splitlines()[0].decode()
assert counts==dict(render=2,constraints=2,functional=27,polish=4)
assert len(changed)==7
assert sum(j['judge']['timeout'] for j in judges.values())+1000<12000<config['verifier']['timeout_sec']
assert files['tests/test.sh']==old['tests/test.sh']
assert files['tests/app-lifecycle.sh']==old['tests/app-lifecycle.sh']
assert files['tests/reward.toml']==old['tests/reward.toml']
assert b'http://127.0.0.1:3000/' in files['tests/test.sh']
for name in ('additional-regression.json','oracle-failures-regression.json'):
    assert all(c['passed'] for c in json.loads((out/name).read_text())['results'])
assert (out/'local-validation.json').exists()
assert json.loads((out/'harness-integration.json').read_text())['two_restarts_and_final_cleanup']=='passed'
assert all(c['rejected'] for c in json.loads((out/'coverage-negative-controls.json').read_text()))

oracle=root/'run-outputs/patchpad-editor-v2/run-6e931938/patchpad-editor-v2__KBkofJR'
haiku=root/'run-outputs/patchpad-editor-v2/run-32a383d4/patchpad-editor-v2__ZCnGYjw'
detail=json.loads((oracle/'verifier/reward-details.json').read_text())
failures=[dict(id=c['id'],weight=c['weight'],reasoning=c['reasoning']) for d in detail.values() for c in d.get('criteria',[]) if c['value']<1]
assert {c['id'] for c in failures}==set(changed)
for relative in ('public/js/app.js','src/index.js','src/db.js','public/index.html'):
    assert (oracle/'artifacts/app'/relative).read_bytes().replace(b'\r\n',b'\n')==files['solution/app/'+relative]
manifest=(haiku/'artifacts/app/APP_MANIFEST.md').read_text()
assert not re.findall(r'^\s*(?:-\s+)?SQLite path:\s*([^\r\n]+)',manifest,re.M|re.I)
evidence=dict(oracle_reward=json.loads((oracle/'verifier/reward.json').read_text()),oracle_failures=failures,oracle_action_trace_exported=False,haiku_reward=json.loads((haiku/'verifier/reward.json').read_text()),haiku_failure='Manifest does not contain the explicitly required SQLite path: line; preflight exits before browser grading',scope='Historical 2.0.6 results, not a score for 2.0.7')
(out/'run-findings.json').write_text(json.dumps(evidence,indent=2)+'\n')
images={role:json.loads(subprocess.check_output(['docker','image','inspect',f'patchpad-preflight-{role}:2.0.7']))[0]['Id'] for role in ('env','tests')}
archive=out/(slug+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo(slug+'/'+name,(2026,9,10,0,0,0));info.create_system=3
        info.external_attr=(stat.S_IFREG|(0o755 if name.endswith('.sh') else 0o644))<<16
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
hashes={n:sha(data) for n,data in files.items()}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(set(z.namelist()))==30
    assert {n.removeprefix(slug+'/'):sha(z.read(n)) for n in z.namelist()}==hashes
report=dict(version='2.0.7',archive=archive.name,sha256=sha(archive.read_bytes()),files=hashes,images=images,criteria=counts,changed_criterion_guidance=changed,original_assertions_preserved=True,weights_and_golden_logic_unchanged=True,readiness_and_lifecycle_unchanged=True,scope='Local unpaid validation only; actual QC checker and Oracle not run')
(out/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'SHA256SUMS.txt').write_text(report['sha256']+'  '+archive.name+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('files','images')},indent=2))
