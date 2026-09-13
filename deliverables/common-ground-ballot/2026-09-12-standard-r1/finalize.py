import hashlib
import json
import re
import tomllib
import zipfile
from pathlib import Path

out = Path(__file__).resolve().parent
task = out.parents[2] / 'projects/common-ground-ballot'
def sha(data):
    return hashlib.sha256(data).hexdigest()
def read(name):
    return json.loads((out / name).read_text())
def write(name, value):
    (out / name).write_text(json.dumps(value, indent=2) + '\n')

files = {p.relative_to(task).as_posix():p.read_bytes() for p in sorted(task.rglob('*')) if p.is_file()}
allow = {'README.md','environment','instruction.md','rubrics','solution','task.toml','tests'}
assert all(n.split('/')[0] in allow for n in files)
for n, b in files.items():
    assert not set(Path(n).parts) & {'.git','node_modules','__pycache__','reports','jobs'}
    assert not n.endswith(('.db','.sqlite','.pyc','.zip'))
    assert not re.search(rb'sk-(?:or-v1-|proj-)[A-Za-z0-9_-]{16,}', b)
    if n.endswith(('.sh','.py')):
        assert b'\r\n' not in b,n
with zipfile.ZipFile(out / 'before-source.zip') as z:
    before = {n:z.read(n) for n in z.namelist()}
for n in files:
    if n.endswith('common_ground_seed.json'):
        assert files[n] == before[n],n
config = tomllib.loads(files['task.toml'].decode())
assert config['task']['version'] == '1.0.0'
dims = ['render','constraints','functional','polish','visual']
judges = {d:tomllib.loads(files[f'tests/{d}/judge.toml'].decode()) for d in dims}
ids = {c['id'] for j in judges.values() for c in j['criterion']}
assert len(ids) == 33
old = read('previous-coverage.json')
groups = old['requirements'] + old['nonfunctional_requirements']
for i, group in enumerate(groups):
    group['id'] = 'REQ-' + str(i+1).zfill(2)
    group['criteria'] = [c for c in group['criteria'] if c in ids]
    names = re.findall(r'\b[\w-]+\.md\b', group['source'])
    group['source_files'] = [('instruction.md' if n=='instruction.md' else 'environment/instructions/'+n) for n in names]
    assert all(n in files for n in group['source_files']),group
visual_ids = [c['id'] for c in judges['visual']['criterion']]
groups = [g for g in groups if g['criteria']]
groups.append({'id':'REQ-VISUAL','source':'interface.md: readable and coherent presentation across workspaces, themes and sizes',
               'source_files':['environment/instructions/interface.md'],'criteria':visual_ids})
groups.append({'id':'REQ-STORAGE','source':'runtime.md: real SQLite holds accepted data and sessions',
               'source_files':['environment/instructions/runtime.md'],'criteria':['entrypoint_refresh_usable','durable_reauthentication_and_seed_safety']})
groups.append({'id':'REQ-AUTH-NEGATIVE','source':'overview.md and privacy.md: valid accounts and protected access',
               'source_files':['environment/instructions/overview.md','environment/instructions/privacy.md'],
               'criteria':['seeded_roles_and_ballot_states','distinct_sessions_and_global_revocation']})
assert {c for g in groups for c in g['criteria']} == ids
write('coverage.json',{'task':'common-ground-ballot','task_version':'1.0.0','scope':'External requirement-to-verifier authoring map, not a QC verdict', 'requirements':groups})
provenance = read('prompt-provenance.json')
for d in dims:
    assert provenance['judges'][d]['prompt_sha256'] == sha(files[f'tests/{d}/prompt.md'])
    assert provenance['judges'][d]['judge_sha256'] == sha(files[f'tests/{d}/judge.toml'])
    text = files[f'tests/{d}/prompt.md'].decode()
    assert not re.search(r'Bazaarbridge|Docketlight|Torquebay|Boardloom|GridForge|PatchPad',text,re.I)
assert provenance['runner_sha256'] == sha(files['tests/test.sh'])
assert provenance['reward_sha256'] == sha(files['tests/reward.toml'])
assert read('standard-checks.json')['passed']
for name in ['runtime-results.json','browser-results.json','harness-results.json','agent-preflight.json']:
    assert all(r['passed'] for r in read(name)['results']),name
assert not read('browser-results.json')['errors']
assert all(r['exit_code']==0 for r in read('validation.json')['builds'])
changes=[]
for d,j in judges.items():
    key=f'tests/{d}/judge.toml'
    old_criteria={c['id']:c for c in tomllib.loads(before[key].decode())['criterion']} if key in before else {}
    now={c['id']:c for c in j['criterion']}
    for c in sorted(now.keys() | old_criteria.keys()):
        if now.get(c)!=old_criteria.get(c):changes.append({'dimension':d,'id':c,'before':old_criteria.get(c),'after':now.get(c)})
    if d=='functional':
        assert all(now[c]['weight']==old_criteria[c]['weight'] for c in old_criteria)
write('before-after.json',{'old_config':tomllib.loads(before['task.toml'].decode()),'new_config':config,'criterion_changes':changes,
                        'file_changes':[n for n in sorted(before.keys()|files.keys()) if before.get(n)!=files.get(n)]})
destination=out/'common-ground-ballot.zip'
with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in files.items():
        info=zipfile.ZipInfo('common-ground-ballot/'+n,(2026,9,12,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16
        z.writestr(info,b)
with zipfile.ZipFile(destination) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(files)
    for n,b in files.items():assert z.read('common-ground-ballot/'+n)==b
write('source-hashes.json',{n:sha(b) for n,b in files.items()})
digest=sha(destination.read_bytes())
(out/'SHA256SUMS.txt').write_text(digest+'  '+destination.name+'\n')
write('package-audit.json',{'local_status':'passed','task_version':'1.0.0','file_count':len(files),
                          'criteria':{d:len(j['criterion']) for d,j in judges.items()},'root_allowlist_passed':True,
                          'coverage_external':True,'all_criteria_mapped':True,'seeds_unchanged':True,
                          'runtime_provenance_matches_zip':True,'zip_sha256':digest,'oracle_run':False,'platform_qc_run':False})
print('PASS package:',len(files),'files,',len(ids),'criteria; SHA256',digest)
