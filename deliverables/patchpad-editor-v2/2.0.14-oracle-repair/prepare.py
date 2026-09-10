"""Freeze the new PatchPad package; every criterion and scoring rule preserved."""
from pathlib import Path
import hashlib,json,re,tomllib,zipfile
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2];TASK=ROOT/'projects/patchpad-editor-v2';SLUG=TASK.name
PREV=OUT.parent/'2.0.13-reward-alignment'/f'{SLUG}.zip'
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
with zipfile.ZipFile(PREV) as z:old={n[len(SLUG)+1:]:z.read(n) for n in z.namelist()}
checks=[]
def check(n,v):
    assert v,n
    checks.append(n)
def sha(b):return hashlib.sha256(b).hexdigest()
check('Exact clean 30-file inventory',set(files)==set(old) and len(files)==30)
changed={'solution/app/public/js/app.js','solution/app/public/index.html','tests/functional/prompt.md'}
for n,b in files.items():
    check('Clean safe member '+n,not set(n.split('/'))&{'node_modules','.git','..','__pycache__'} and Path(n).suffix not in ('.db','.sqlite','.pyc','.zip','.docx','.log'))
    s=b.decode('utf-8');check('UTF8 LF no BOM '+n,b'\r' not in b and not b.startswith(b'\xef\xbb\xbf'))
    check('No literal credential '+n,not re.search(r'sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}',s))
    if n.endswith('.toml'):tomllib.loads(s)
    if n.endswith('.json'):json.loads(s)
    if n not in changed:check('Only release markers differ '+n,b.replace(b'2.0.14',b'2.0.13')==old[n])
t=tomllib.loads(files['task.toml'].decode())
check('Canonical name/version',t['task']['name']=='turing/'+SLUG and t['task']['version']=='2.0.14')
check('Public agent/public separate verifier',t['environment']['network_mode']==t['verifier']['environment']['network_mode']=='public' and t['verifier']['environment_mode']=='separate')
check('Unchanged provider placeholder only',t['verifier']['env']==tomllib.loads(old['task.toml'].decode())['verifier']['env'])
counts={}
for d in ('render','constraints','functional','polish'):
    n=f'tests/{d}/judge.toml';v=tomllib.loads(files[n].decode());o=tomllib.loads(old[n].decode());counts[d]=len(v['criterion'])
    check('All judge settings/criteria/weights unchanged '+d,v==o)
    check('Version and criteria insertion '+d,'2.0.14' in files[f'tests/{d}/prompt.md'].decode() and '{criteria}' in files[f'tests/{d}/prompt.md'].decode())
check('35 criteria retained',counts==dict(render=2,constraints=2,functional=27,polish=4))
for n in ('tests/test.sh','tests/app-lifecycle.sh','tests/reward.toml'):
    check('Runner/lifecycle/reward untouched '+n,files[n]==old[n])
check('Unchanged 90/10','0.9 * data["functional"] + 0.1 * data["polish"]' in files['tests/test.sh'].decode())
prompt=files['tests/functional/prompt.md'].decode();before=old['tests/functional/prompt.md'].decode().replace('2.0.13','2.0.14')
start=prompt.index('- Capture transient evidence before leaving its state.')
end=prompt.index('- Before appending a required final-line sample,',start)
check('Previous Functional prompt entirely retained',prompt[:start]+prompt[end:]==before)
js=files['solution/app/public/js/app.js'].decode()
check('Honest Undo/Redo availability','undo-btn\').disabled = state.undo.length === 0' in js and 'redo-btn\').disabled = state.redo.length === 0' in js)
check('Existing Escape directions preserved',"if (event.key === 'Escape')" in js and "document.getElementById('find-box').focus();" in js and 'editor.focus();' in js)
check('No server/seed/dependency changes',all(files[n]==old[n] for n in files if n.startswith('solution/app/src/') or 'incident_seed.json' in n or '/instructions/' in n))
target=OUT/f'{SLUG}.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in sorted(files.items()):
        i=zipfile.ZipInfo(SLUG+'/'+n,(2026,9,10,0,0,0));i.create_system=3;i.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,b)
with zipfile.ZipFile(target) as z:check('Archive CRC/exact wrapper/source bytes',z.testzip() is None and set(z.namelist())=={SLUG+'/'+n for n in files} and all(z.read(SLUG+'/'+n)==b for n,b in files.items()))
r=dict(version='2.0.14',files=len(files),criteria=counts,sha256=sha(target.read_bytes()),checks=checks,source_hashes={n:sha(b) for n,b in files.items()},scope='Local preservation/package audit, not official platform QC')
(OUT/'package-audit.json').write_text(json.dumps(r,indent=2)+'\n');(OUT/'SHA256SUMS.txt').write_text(r['sha256']+'  '+target.name+'\n');print(json.dumps(dict(checks=len(checks),criteria=counts,sha256=r['sha256'])))
