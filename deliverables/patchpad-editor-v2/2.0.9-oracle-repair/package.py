import hashlib, json, re, stat, subprocess, tomllib, zipfile
from pathlib import Path
out=Path(__file__).resolve().parent; root=out.parents[2]; slug='patchpad-editor-v2'
task=root/'projects'/slug; sha=lambda b:hashlib.sha256(b).hexdigest()
prior=out.parent/'2.0.8-hardening'/f'{slug}.zip'
assert sha(prior.read_bytes())=='c8775a9a6b2d9c394d7ebf07933e0282a629d4dcb0dc1b854b6c0577b822b825'
with zipfile.ZipFile(prior) as z: old={n.removeprefix(slug+'/'):z.read(n) for n in z.namelist()}
files={p.relative_to(task).as_posix():p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert set(files)==set(old) and len(files)==30
changed=[]
for n,b in files.items():
    assert b'\r' not in b and not b.startswith(b'\xef\xbb\xbf'),n
    assert not re.search(rb'sk-or-v1-[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----',b),n
    if n.endswith('.json'):json.loads(b)
    if n.endswith('.toml'):tomllib.loads(b.decode())
    if b!=old[n].replace(b'2.0.8',b'2.0.9'):changed.append(n)
assert set(changed)=={'instruction.md','solution/app/public/js/app.js','tests/functional/prompt.md'}
counts={}
for dim in ['render','constraints','functional','polish']:
    n=f'tests/{dim}/judge.toml'; j=tomllib.loads(files[n].decode())
    assert j==tomllib.loads(old[n].decode())
    counts[dim]=len(j['criterion'])
assert counts==dict(render=2,constraints=2,functional=27,polish=4)
cfg=tomllib.loads(files['task.toml'].decode())
assert cfg['task']['name']=='turing/'+slug and cfg['task']['version']=='2.0.9'
assert cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public'
assert files['tests/test.sh']==old['tests/test.sh']
assert files['tests/app-lifecycle.sh']==old['tests/app-lifecycle.sh']
assert files['tests/reward.toml']==old['tests/reward.toml']
state=json.loads(subprocess.check_output(['docker','inspect','patchpad-209-release']))[0]['State']
assert state['Status']=='exited' and state['ExitCode']==0
for name in ['targeted-after','browser-variants','additional-regression','oracle-failures-regression']:
    assert all(c['passed'] for c in json.loads((out/(name+'.json')).read_text())['results']),name
assert not json.loads((out/'targeted-before.json').read_text())['results'][0]['passed']
oracle=root/'run-outputs/patchpad-editor-v2/run-f7de94c0-7429-4857-9cca-060af4126860/patchpad-editor-v2__5aRyw9S'
haiku=root/'run-outputs/patchpad-editor-v2/run-48c545c9-dad0-45bc-8437-a47ed9b9d6a1/patchpad-editor-v2__qcXBP96'
for name in ['public/js/app.js','public/index.html','src/index.js','src/db.js']:
    assert (oracle/'artifacts/app'/name).read_bytes().replace(b'\r\n',b'\n')==old['solution/app/'+name]
details=json.loads((oracle/'verifier/reward-details.json').read_text())
failures=[c for c in details['functional']['criteria'] if c['value']==0]
assert len(failures)==7
findings=dict(oracle_reward=json.loads((oracle/'verifier/reward.json').read_text()),oracle_failures=failures,
              haiku_reward=json.loads((haiku/'verifier/reward.json').read_text()),
              haiku_failure='Explicit SQLite path: line absent; unchanged parser rejected manifest before browser grading',
              historical_task_version='2.0.8',not_a_current_release_grade=True)
(out/'run-findings.json').write_text(json.dumps(findings,indent=2)+'\n')
archive=out/f'{slug}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in sorted(files.items()):
        i=zipfile.ZipInfo(slug+'/'+n,(2026,9,10,0,0,0));i.create_system=3
        i.external_attr=(stat.S_IFREG|(0o755 if n.endswith('.sh') else 0o644))<<16
        i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,b)
hashes={n:sha(b) for n,b in files.items()}
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist())==30
    assert {n.removeprefix(slug+'/'):sha(z.read(n)) for n in z.namelist()}==hashes
report=dict(version='2.0.9',sha256=sha(archive.read_bytes()),files=hashes,criteria=counts,changed_logic_files=changed,
            all_criteria_and_weights_unchanged=True,public_agent_and_verifier=True,
            scope='Fresh unpaid local regression only; no platform QC or Oracle result for 2.0.9')
(out/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'SHA256SUMS.txt').write_text(report['sha256']+'  '+archive.name+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
