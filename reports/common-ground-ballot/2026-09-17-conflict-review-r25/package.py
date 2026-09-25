from pathlib import Path
import hashlib
import json
import stat
import subprocess
import sys
import tomllib
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'
DEST=ROOT/'deliverables/common-ground-ballot/2026-09-17-conflict-review-r25'
DEST.mkdir(parents=True,exist_ok=True)
ZIP=DEST/'common-ground-ballot.zip'
assert not ZIP.exists(),'Published ZIPs are immutable; use another release if a change is needed.'

for mode,file,expected in [('review','review-results.json',7),('identity','identity-results.json',7),('helper-integration','helper-results.json',19),('browser-regression','browser-results.json',45)]:
    data=json.loads((HERE/mode/file).read_text(encoding='utf-8'))
    assert len(data['results'])==expected and all(row['passed'] for row in data['results']),mode
assert json.loads((HERE/'runtime-smoke/runtime-smoke-results.json').read_text())['passed']==30
mutants=json.loads((HERE/'mutation-results.json').read_text())
assert len(mutants)==6 and all(row['detected'] for row in mutants)
gpt=json.loads((HERE/'gpt-replay/gpt-replay-results.json').read_text(encoding='utf-8'))
assert gpt['passed']==6 and gpt['failed']==0
assert len(gpt['observations'])==6
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files)==29
with zipfile.ZipFile(HERE/'before-r25.zip') as baseline:
    changed=sorted(name for name,data in files.items() if data!=baseline.read(name))
    assert changed==sorted(['README.md','instruction.md','task.toml','solution/public/app.js','solution/public/index.html','solution/public/styles.css','tests/functional/judge.toml','tests/functional/prompt.md']),changed
    assert files['tests/test.sh']==baseline.read('tests/test.sh')
    before=tomllib.loads(baseline.read('task.toml').decode())
    after=tomllib.loads(files['task.toml'].decode())
    assert all(before[k]==after[k] for k in ('schema_version','artifacts','agent','environment','verifier'))
    for dim in ('render','constraints','polish','visual'):
        for name in ('judge.toml','prompt.md'):
            key=f'tests/{dim}/{name}';assert files[key]==baseline.read(key)
provenance=json.loads((HERE/'runtime-smoke/runner-1/prompt-provenance.json').read_text())
for dim,info in provenance['judges'].items():
    assert hashlib.sha256(files[f'tests/{dim}/prompt.md']).hexdigest()==info['prompt_sha256']
    assert hashlib.sha256(files[f'tests/{dim}/judge.toml']).hexdigest()==info['judge_sha256']
subprocess.run([sys.executable,str(HERE/'validate-package.py')],check=True)
with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name,data in sorted(files.items()):
        info=zipfile.ZipInfo('common-ground-ballot/'+name,date_time=(2026,9,17,0,0,0))
        info.create_system=3
        info.external_attr=(stat.S_IFREG|(0o755 if name.endswith('.sh') else 0o644))<<16
        info.compress_type=zipfile.ZIP_DEFLATED
        archive.writestr(info,data)
subprocess.run([sys.executable,str(HERE/'validate-package.py'),str(ZIP)],check=True)
digest=hashlib.sha256(ZIP.read_bytes()).hexdigest()
manifest={'archive':str(ZIP.relative_to(ROOT)),'sha256':digest,'bytes':ZIP.stat().st_size,'files':len(files),'changed_files':changed,'criteria':77,'functional_criteria':57,'browser_checks_passed':78,'mutants_detected':6,'runner_checks_passed':30,'scored_oracle':False,'scored_model':False,'files_sha256':{n:hashlib.sha256(d).hexdigest() for n,d in sorted(files.items())}}
(HERE/'package-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in manifest.items() if k!='files_sha256'},indent=2))
