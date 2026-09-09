import hashlib,json,re,stat,subprocess,tomllib,zipfile
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[2];slug='brickfall-breaker-arcade';task=root/'projects'/slug
sha=lambda b:hashlib.sha256(b).hexdigest()
prior=out.parent/'2.0.0-canonical'/f'{slug}.zip'
assert sha(prior.read_bytes())=='97ba58cb752615c11e623f644cbf8a2d9cd1f49c9bcb3c893214dd775c4695b4'
with zipfile.ZipFile(prior) as z:old={n.removeprefix(slug+'/'):z.read(n) for n in z.namelist()}
files={p.relative_to(task).as_posix():p.read_bytes() for p in task.rglob('*') if p.is_file()}
assert set(files)==set(old) and len(files)==30
allowed={'task.toml','tests/render/judge.toml','tests/constraints/judge.toml',*[f'tests/{d}/prompt.md' for d in ['render','constraints','functional','polish']]}
changed=[];gates=[];counts={}
for n,b in files.items():
    if n.endswith('.xlsx'):assert b==old[n];continue
    assert b'\r' not in b and not b.startswith(b'\xef\xbb\xbf'),n
    assert not re.search(rb'sk-or-v1-[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----',b),n
    if n.endswith('.json'):json.loads(b)
    if n.endswith('.toml'):tomllib.loads(b.decode())
    if b!=old[n].replace(b'2.0.0',b'2.0.1'):
        assert n in allowed,n;changed.append(n)
for d in ['render','constraints','functional','polish']:
    n=f'tests/{d}/judge.toml';j=tomllib.loads(files[n].decode());prior_j=tomllib.loads(old[n].decode())
    assert j['judge']==prior_j['judge'] and j['scoring']==prior_j['scoring']
    for c,p in zip(j['criterion'],prior_j['criterion']):
        assert {k:v for k,v in c.items() if k!='description'}=={k:v for k,v in p.items() if k!='description'}
        if d in ['functional','polish']:assert c==p
    counts[d]=len(j['criterion']);prompt=files[f'tests/{d}/prompt.md'].decode()
    gate=prompt.split('Global browser gate (mandatory before scoring any criterion):\n')[1].split('\n\n')[0]
    gates.append(gate)
    for phrase in ['protected player data is hidden','wrong-pass-47','password123','same-origin server response','assign 0 to EVERY','untrusted']:
        assert phrase in gate,(d,phrase)
    assert '{criteria}' in prompt
assert len(set(gates))==1 and counts==dict(render=2,constraints=2,functional=16,polish=7)
cfg=tomllib.loads(files['task.toml'].decode())
assert cfg['task']['version']=='2.0.1' and cfg['task']['name']=='turing/'+slug
assert cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public'
for n in ['tests/test.sh','tests/reward.toml','solution/app/server.js','solution/app/public/index.html']:
    assert files[n]==old[n]
assert all(c['passed'] and c['ranked_state_unchanged'] for c in json.loads((out/'gate-regression.json').read_text())['results'])
assert len(json.loads((out/'browser-regression.json').read_text())['passed'])==12
state=json.loads(subprocess.check_output(['docker','inspect','brickfall-201-gates']))[0]['State']
assert state['Status']=='exited' and state['ExitCode']==0
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
report=dict(version='2.0.1',sha256=sha(archive.read_bytes()),files=hashes,criteria=counts,
            all_dimension_auth_backend_gates=True,changed_files=changed,gameplay_and_weights_unchanged=True,
            public_agent_and_verifier=True,scope='Local gate and gameplay regressions; no actual platform QC or paid run.')
(out/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n')
(out/'SHA256SUMS.txt').write_text(report['sha256']+'  '+archive.name+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
