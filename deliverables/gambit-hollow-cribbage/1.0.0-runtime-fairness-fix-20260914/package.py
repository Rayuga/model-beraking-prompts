from pathlib import Path
import hashlib,importlib.util,json,shutil,tomllib,zipfile

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2];TASK=ROOT/'projects/gambit-hollow-cribbage';WRAPPER=TASK.name+'/'
BASE=OUT.parent/'1.0.0-full-preflight-20260914/gambit-hollow-cribbage.zip'
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
with zipfile.ZipFile(BASE) as z:before={n.removeprefix(WRAPPER):z.read(n) for n in z.namelist()}
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert files.keys()==before.keys() and len(files)==37
changed=sorted(n for n in files if files[n]!=before[n])
expected=['tests/test.sh','tests/app-lifecycle.sh']+[f'tests/{d}/{f}' for d in ('render','functional','polish','visual') for f in ('judge.toml','prompt.md')]
assert changed==sorted(expected),changed
for d in ('render','constraints','functional','polish','visual'):
    old=tomllib.loads(before[f'tests/{d}/judge.toml'].decode());new=tomllib.loads(files[f'tests/{d}/judge.toml'].decode())
    assert old['judge']==new['judge'] and old['scoring']==new['scoring']
    assert [{k:v for k,v in c.items() if k!='description'} for c in old['criterion']]==[{k:v for k,v in c.items() if k!='description'} for c in new['criterion']]
for name in ('test.sh','app-lifecycle.sh'):
    line='sh -c \'cd -- "$(dirname -- "$1")" && exec node "$1"\' sh "$APP_ENTRY"'
    assert line in files['tests/'+name].decode()
archive=OUT/'gambit-hollow-cribbage.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in sorted(files.items()):
        info=zipfile.ZipInfo(WRAPPER+n,(2026,9,14,0,0,0));info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16;z.writestr(info,b)
for folder,data in [('extracted',files),('previous',before)]:
    for n,b in data.items():
        p=OUT/folder/TASK.name/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
upload=load('upload',ROOT/'references/task-templates/check-upload.py').audit(archive)
standard=load('standard',ROOT/'references/task-templates/check-standard.py').validate(OUT/'extracted'/TASK.name)
(OUT/'archive-checks.json').write_text(json.dumps(upload,indent=2)+'\n');(OUT/'standard-checks.json').write_text(json.dumps(standard,indent=2)+'\n')
source={n:hashlib.sha256(b).hexdigest() for n,b in files.items()}
(OUT/'source-sha256.json').write_text(json.dumps(source,indent=2)+'\n')
(OUT/'changes.json').write_text(json.dumps({'baseline':str(BASE),'changed_files':changed,'zip_sha256':upload['sha256'],'golden_assets_weights_and_criterion_ids_unchanged':True},indent=2)+'\n')
prior=OUT.parent/'1.0.0-full-preflight-20260914'
for name in ('browser.cjs','unit.cjs','run-local.sh','negative-runner.sh'):
    if not (OUT/name).exists():shutil.copyfile(prior/name,OUT/name)
variant=OUT/'relative-solution';shutil.copytree(TASK/'solution',variant,dirs_exist_ok=True)
p=variant/'serve.js';s=p.read_text();assert "express.static(path.join(ROOT, 'www'))" in s
s=s.replace('const ROOT = __dirname;','const ROOT = process.cwd();').replace("express.static(path.join(ROOT, 'www'))","express.static('www')")
p.write_text(s,encoding='utf-8',newline='\n')
print('PASS',len(upload['checks']),'archive and',len(standard['checks']),'standard checks;',len(changed),'verifier files changed')
