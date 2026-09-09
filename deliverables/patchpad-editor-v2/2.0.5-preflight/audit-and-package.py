"""PatchPad-only audit/export. Never writes shared files or historical evidence."""
from pathlib import Path
import hashlib
import json
import re
import stat
import subprocess
import tomllib
import zipfile
import openpyxl

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
TASK = ROOT / 'projects/patchpad-editor-v2'
SLUG, VERSION = 'patchpad-editor-v2', '2.0.5'
checks = []
def check(name, condition):
    checks.append(dict(check=name, passed=bool(condition)))
    assert condition, name
def digest(data):
    return hashlib.sha256(data).hexdigest()
def read(path):
    return path.read_text(encoding='utf-8')

files = sorted(p for p in TASK.rglob('*') if p.is_file())
config = tomllib.loads(read(TASK/'task.toml'))
judges = {d: tomllib.loads(read(TASK/f'tests/{d}/judge.toml')) for d in ('render','constraints','functional','polish')}
check('identity and version', config['task']['name']=='turing/'+SLUG and config['task']['version']==VERSION)
check('both networks public; verifier separate', config['environment']['network_mode']=='public' and config['verifier']['environment']['network_mode']=='public' and config['verifier']['environment_mode']=='separate')
check('exact 35 criteria', {d:len(j['criterion']) for d,j in judges.items()}==dict(render=2,constraints=2,functional=27,polish=4))
check('one restart helper and criterion', len(list((TASK/'tests').glob('*lifecycle*')))==1 and not (TASK/'tests/app-control.sh').exists() and not (TASK/'tests/restart-app.sh').exists() and sum('restart' in c['id'] for j in judges.values() for c in j['criterion'])==1)
for p in files:
    data=p.read_bytes()
    check('LF/UTF8 '+str(p.relative_to(TASK)), not data.startswith(b'\xef\xbb\xbf') and b'\r' not in data)
    data.decode('utf-8')
    if p.suffix=='.toml': tomllib.loads(data.decode())
    if p.suffix=='.json': json.loads(data)
check('parsed all JSON and TOML',True)
check('no secrets or generated files', all(not re.search(rb'(?:sk-or-v1-[A-Za-z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----)',p.read_bytes()) and p.suffix not in ('.zip','.db','.sqlite','.pyc','.xlsx','.docx','.log') and not {'node_modules','__pycache__','.git','reports','data'}.intersection(p.relative_to(TASK).parts) for p in files))
expected_files={'task.toml','instruction.md','environment/Dockerfile','environment/assets/incident_seed.json','solution/solve.sh','solution/app/APP_MANIFEST.md','solution/app/package.json','solution/app/package-lock.json','solution/app/src/db.js','solution/app/src/index.js','solution/app/public/index.html','solution/app/public/js/app.js','tests/Dockerfile','tests/test.sh','tests/app-lifecycle.sh','tests/reward.toml','tests/incident_seed.json'}
expected_files|={f'environment/assets/instructions/{n}.md' for n in ('overview','editing','persistence','conflict-safety','interface')}
expected_files|={f'tests/{d}/{f}' for d in judges for f in ('judge.toml','prompt.md')}
check('exact task-only source inventory', {p.relative_to(TASK).as_posix() for p in files}==expected_files)
for f in ('solution/app/package.json','solution/app/package-lock.json'):
    package=json.loads(read(TASK/f));check(f+' root version',package['version']==VERSION)
    if 'packages' in package: check('lock root version',package['packages']['']['version']==VERSION)
for f in ('environment/Dockerfile','tests/Dockerfile'):
    text=read(TASK/f);check(f+' pinned image and dependency', '@sha256:' in text and 'express@5.2.1' in text and f'io.turing.task.version="{VERSION}"' in text)
check('identical seed copies', (TASK/'environment/assets/incident_seed.json').read_bytes()==(TASK/'tests/incident_seed.json').read_bytes())
check('task time budget within six hours',sum((config['agent']['timeout_sec'],config['environment']['build_timeout_sec'],config['verifier']['timeout_sec']))<=21600)
check('judge budget plus overhead fits runner',sum(j['judge']['timeout'] for j in judges.values())+1000<12000<config['verifier']['timeout_sec'])
baseline={}
for d,j in judges.items():
    old=subprocess.check_output(['git','show',f'HEAD:projects/{SLUG}/tests/{d}/judge.toml'],cwd=ROOT).decode()
    previous=tomllib.loads(old); baseline[d]=previous
    check(d+' criteria and weights unchanged from merged source', previous==j)
    prompt=read(TASK/f'tests/{d}/prompt.md')
    old_prompt=subprocess.check_output(['git','show',f'HEAD:projects/{SLUG}/tests/{d}/prompt.md'],cwd=ROOT).decode()
    check(d+' prompt unchanged except release marker',old_prompt.replace('v2.0.4','v2.0.5')==prompt)
    check(d+' judge pins and prompt safety',j['judge']['judge']=='codex' and j['judge']['model']=='openai/gpt-5.6-luna' and j['judge']['reasoning_effort']=='high' and j['judge']['temperature']==0 and '{criteria}' in prompt and 'untrusted' in prompt and 'independently' in prompt and 'http://localhost:3000' in prompt)
    check(d+' version markers', read(TASK/f'tests/{d}/judge.toml').startswith(f'# Prompt version: {SLUG}-{d}-v{VERSION}') and prompt.startswith(f'# Prompt version: {SLUG}-{d}-v{VERSION}'))
for f in ['instruction.md',*[f'environment/assets/instructions/{n}.md' for n in ('overview','editing','persistence','conflict-safety','interface')],'tests/test.sh','tests/app-lifecycle.sh','tests/reward.toml','solution/app/src/db.js','solution/app/public/index.html']:
    previous=subprocess.check_output(['git','show',f'HEAD:projects/{SLUG}/{f}'],cwd=ROOT)
    check('preserved '+f,previous==(TASK/f).read_bytes())
check('historical failures all exercised and passed',len(json.loads(read(OUT/'oracle-failures-regression.json'))['results'])==8 and all(r['passed'] for r in json.loads(read(OUT/'oracle-failures-regression.json'))['results']))
check('additional regressions all passed',all(r['passed'] for r in json.loads(read(OUT/'additional-regression.json'))['results']))
check('negative controls both rejected',all(r['rejected'] for r in json.loads(read(OUT/'coverage-negative-controls.json'))))
check('nine scoring/cleanup cases exercised',len(json.loads(read(OUT/'harness-matrix.json'))['results'])==9)
images={}
for role in ('env','tests'):
    record=json.loads(subprocess.check_output(['docker','image','inspect',f'patchpad-preflight-{role}:{VERSION}']))[0]
    check(role+' built final image version',record['Config']['Labels']['io.turing.task.version']==VERSION)
    images[role]={'id':record['Id'],'labels':record['Config']['Labels']}
workbook=ROOT/'WebDev Rubrics QC.xlsx'
w=openpyxl.load_workbook(workbook,data_only=True)
rubric={'sha256':digest(workbook.read_bytes()),'scope':'Workbook inventory; descriptions are not executable platform checks','sheets':{s.title:list(s.values) for s in w}}
(OUT/'rubric-inventory.json').write_text(json.dumps(rubric,indent=2)+'\n',encoding='utf-8')
hashes={p.relative_to(TASK).as_posix():digest(p.read_bytes()) for p in files}
archive_path=OUT/(SLUG+'.zip')
with zipfile.ZipFile(archive_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files:
        info=zipfile.ZipInfo(SLUG+'/'+p.relative_to(TASK).as_posix(),(2026,9,9,0,0,0));info.create_system=3
        info.external_attr=((stat.S_IFREG | (0o755 if p.suffix=='.sh' else 0o644))<<16)
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
with zipfile.ZipFile(archive_path) as z:
    check('ZIP CRC',z.testzip() is None)
    check('ZIP exactly one wrapper and no duplicates',len(z.namelist())==len(set(z.namelist()))==len(files) and all(n.startswith(SLUG+'/') and '..' not in n.split('/') for n in z.namelist()))
    check('ZIP hashes exactly match source',{n[len(SLUG)+1:]:digest(z.read(n)) for n in z.namelist()}==hashes)
    packed=tomllib.loads(z.read(SLUG+'/task.toml').decode());check('ZIP both networks public',packed['environment']['network_mode']==packed['verifier']['environment']['network_mode']=='public')
report={'scope':'Local unpaid checks, not platform QC/Oracle/model score','version':VERSION,'criteria':{d:len(j['criterion']) for d,j in judges.items()},'functional_weight':sum(c['weight'] for c in judges['functional']['criterion']),'checks':checks,'images':images,'files':hashes,'archive':archive_path.name,'archive_sha256':digest(archive_path.read_bytes()),'file_count':len(files)}
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(OUT/'SHA256SUMS.txt').write_text(report['archive_sha256']+'  '+archive_path.name+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ('version','criteria','functional_weight','archive','archive_sha256','file_count')},indent=2))
print(f'{len(checks)}/{len(checks)} local checks passed')
