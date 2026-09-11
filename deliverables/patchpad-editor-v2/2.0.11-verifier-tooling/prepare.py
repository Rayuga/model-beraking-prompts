"""Read-only source audit and new release archive; preserves historical releases."""
from pathlib import Path
import hashlib
import json
import re
import tomllib
import zipfile

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2'
SLUG=TASK.name
PREV=OUT.parent/'2.0.10-harbor-template'/f'{SLUG}.zip'
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(PREV) as z:
    old={n[len(SLUG)+1:]:z.read(n) for n in z.namelist() if not n.endswith('/')}
checks=[]
def check(name,ok):
    assert ok,name
    checks.append(name)
def sha(b):return hashlib.sha256(b).hexdigest()
check('Exact prior inventory: 30 task files',set(files)==set(old) and len(files)==30)
for name,b in files.items():
    check('Safe clean path '+name,not set(name.split('/')) & {'..','node_modules','__pycache__','.git'} and Path(name).suffix not in ('.db','.sqlite','.sqlite3','.pyc','.zip','.log','.docx','.xlsx'))
    check('No literal provider key '+name,not re.search(rb'sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}',b))
    check('UTF8 LF no BOM '+name,b'\r' not in b and not b.startswith(b'\xef\xbb\xbf'))
    s=b.decode('utf-8')
    if name.endswith('.toml'):tomllib.loads(s)
    if name.endswith('.json'):json.loads(s)
    if name!='tests/Dockerfile':
        check('Only release markers changed '+name,b.replace(b'2.0.11',b'2.0.10')==old[name])
t=tomllib.loads(files['task.toml'].decode())
check('Name/version',t['task']['name']=='turing/'+SLUG and t['task']['version']=='2.0.11')
check('Public/public separate verifier',t['environment']['network_mode']==t['verifier']['environment']['network_mode']=='public' and t['verifier']['environment_mode']=='separate')
check('Only OpenRouter placeholder and judge settings',t['verifier']['env']=={'OPENROUTER_API_KEY':'${OPENROUTER_API_KEY}','REWARDKIT_JUDGE':'codex','REWARDKIT_MODEL':'openai/gpt-5.6-luna','REWARDKIT_REASONING_EFFORT':'high'})
check('Runner unchanged, no key remapping',files['tests/test.sh']==old['tests/test.sh'] and not re.search(rb'OPENAI|OPENROUTER|API_KEY|model_provider',files['tests/test.sh']))
counts={};budgets=[]
for dim in ('render','constraints','functional','polish'):
    n=f'tests/{dim}/judge.toml';d=tomllib.loads(files[n].decode())
    check('Unchanged judge semantics '+dim,d==tomllib.loads(old[n].decode()))
    check('Codex Luna high '+dim,d['judge']['judge']=='codex' and d['judge']['model']=='openai/gpt-5.6-luna' and d['judge']['reasoning_effort']=='high')
    counts[dim]=len(d['criterion']);budgets.append(d['judge']['timeout'])
check('35 criteria preserved',counts==dict(render=2,constraints=2,functional=27,polish=4))
check('Timeout hierarchy',sum(budgets)<12000<t['verifier']['timeout_sec'] and t['environment']['build_timeout_sec']+t['agent']['timeout_sec']+t['verifier']['timeout_sec']<=21600)
docker=files['tests/Dockerfile'].decode()
for marker in ('@openai/codex@0.151.0','@playwright/mcp@0.0.79','harbor-rewardkit==0.1.7','install --with-deps chromium','command -v codex','command -v playwright-mcp','command -v rewardkit','test -x /usr/local/bin/chromium','pw.chromium.launch','env_key = "OPENROUTER_API_KEY"','mkdir -p /app /logs/verifier'):
    check('Build provisions/asserts '+marker,marker in docker)
check('No hidden key alias in image','OPENAI_API_KEY' not in docker)
check('No old Harbor-tool assumption','Harbor must supply' not in docker)
target=OUT/f'{SLUG}.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in sorted(files.items()):
        info=zipfile.ZipInfo(SLUG+'/'+n,(2026,9,10,0,0,0));info.create_system=3
        info.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16
        info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,b)
with zipfile.ZipFile(target) as z:
    check('Archive CRC',z.testzip() is None)
    check('Single exact wrapper and source hashes',set(z.namelist())=={SLUG+'/'+n for n in files} and all(sha(z.read(SLUG+'/'+n))==sha(b) for n,b in files.items()))
report=dict(version='2.0.11',files=len(files),criteria=counts,sha256=sha(target.read_bytes()),previous_zip_sha256=sha(PREV.read_bytes()),checks=checks,source_hashes={n:sha(b) for n,b in files.items()},scope='Local structure and unchanged-behavior checks, not official platform QC or Oracle.')
(OUT/'package-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(OUT/'SHA256SUMS.txt').write_text(report['sha256']+'  '+target.name+'\n',encoding='utf-8')
print(json.dumps(dict(version=report['version'],passed=len(checks),files=len(files),criteria=counts,sha256=report['sha256'])))
