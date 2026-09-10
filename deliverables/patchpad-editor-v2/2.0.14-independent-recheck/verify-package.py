"""Read-only release recheck: do not rebuild or replace the delivered archive."""
from pathlib import Path
import hashlib,json,tomllib,zipfile
out=Path(__file__).resolve().parent
root=out.parents[2]
task=root/'projects/patchpad-editor-v2'
release=out.parent/'2.0.14-oracle-repair'
archive=release/'patchpad-editor-v2.zip'
expected=json.loads((release/'package-audit.json').read_text())
checks=[]
def check(label,condition):
    assert condition,label
    checks.append(label)
files={p.relative_to(task).as_posix():p.read_bytes() for p in task.rglob('*') if p.is_file()}
sha=lambda b:hashlib.sha256(b).hexdigest()
check('Delivered ZIP hash unchanged',sha(archive.read_bytes())==expected['sha256'])
check('All current source hashes equal reviewed release', {n:sha(b) for n,b in files.items()}==expected['source_hashes'])
with zipfile.ZipFile(archive) as z:
    check('CRC and single exact 30-file wrapper',z.testzip() is None and len(files)==30 and set(z.namelist())=={'patchpad-editor-v2/'+n for n in files})
    for n,b in files.items():check('ZIP/source byte equality: '+n,z.read('patchpad-editor-v2/'+n)==b)
t=tomllib.loads(files['task.toml'].decode())
check('Public agent and verifier, separate environment',t['environment']['network_mode']==t['verifier']['environment']['network_mode']=='public' and t['verifier']['environment_mode']=='separate')
check('Release remains 2.0.14',t['task']['version']=='2.0.14')
counts={};total=0
for d in ('render','constraints','functional','polish'):
    j=tomllib.loads(files[f'tests/{d}/judge.toml'].decode())
    counts[d]=len(j['criterion']);total+=j['judge']['timeout']
    check('Judge configuration: '+d,j['judge']['judge']=='codex' and j['judge']['model']=='openai/gpt-5.6-luna' and j['judge']['reasoning_effort']=='high')
check('All 35 criteria remain',counts==dict(render=2,constraints=2,functional=27,polish=4))
check('Timeout headroom retained',total==10550 and total<12000<t['verifier']['timeout_sec'])
(out/'archive-recheck.json').write_text(json.dumps(dict(passed=len(checks),checks=checks,sha256=expected['sha256'],criteria=counts,source_changed=False,paid_run=False),indent=2)+'\n')
print(f'PASS {len(checks)} read-only package checks; source and delivered ZIP unchanged')
