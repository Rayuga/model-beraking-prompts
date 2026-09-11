"""Audit release invariants and create one source-hash-verified upload ZIP."""
from pathlib import Path
import hashlib, json, re, subprocess, tomllib, zipfile
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
TASK=ROOT/'projects/patchpad-editor-v2'
OLD=OUT.parent/'2.0.15-openai-oracle-repair/patchpad-editor-v2.zip'
sha=lambda b:hashlib.sha256(b).hexdigest()
checks=[]
def check(name,condition):
    assert condition,name
    checks.append(name)
cfg=tomllib.loads((TASK/'task.toml').read_text())
check('Release identity',cfg['task']['name']=='turing/patchpad-editor-v2' and cfg['task']['version']=='2.0.16')
check('Public agent and separate public verifier',cfg['environment']['network_mode']==cfg['verifier']['environment']['network_mode']=='public' and cfg['verifier']['environment_mode']=='separate')
check('Exact requested environment',cfg['verifier']['env']==dict(OPENAI_API_KEY='${OPENAI_API_KEY}',REWARDKIT_JUDGE='codex',REWARDKIT_MODEL='gpt-5.6-luna',REWARDKIT_REASONING_EFFORT='max'))
check('Sandbox lifetime cap',sum([cfg['environment']['build_timeout_sec'],cfg['agent']['timeout_sec'],cfg['verifier']['timeout_sec']])<=21600)
total=0; timeouts=0
with zipfile.ZipFile(OLD) as old:
    oldfiles={i.filename.split('/',1)[1]:old.read(i) for i in old.infolist() if not i.is_dir()}
    newfiles={str(p.relative_to(TASK)).replace('\\','/'):p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
    check('Exactly the same 30 task file paths; no authoring/runtime additions',set(oldfiles)==set(newfiles) and len(newfiles)==30)
    for dimension,count in [('render',2),('constraints',2),('functional',27),('polish',4)]:
        path=f'tests/{dimension}/judge.toml'
        now=tomllib.loads(newfiles[path].decode());before=tomllib.loads(oldfiles[path].decode())
        check(dimension+' criterion identity/types/weights unchanged', [{k:v for k,v in c.items() if k!='description'} for c in now['criterion']]==[{k:v for k,v in c.items() if k!='description'} for c in before['criterion']])
        allowed={'functional':{'find_replace_exact_counts_and_offsets','keyboard_find_focus_and_cycle','restart_seed_idempotence_and_saved_history'},'polish':{'keyboard_focus_and_editor_entry'}}.get(dimension,set())
        changed_ids={c['id'] for c,b in zip(now['criterion'],before['criterion']) if c!=b}
        check(dimension+' only intended fairness clarifications changed',changed_ids==allowed)
        check(dimension+' criterion count',len(now['criterion'])==count)
        total+=count;timeouts+=now['judge']['timeout']
        check(dimension+' provider and max reasoning',now['judge']['judge']=='codex' and now['judge']['model']=='gpt-5.6-luna' and now['judge']['reasoning_effort']=='max')
        check(dimension+' MCP unchanged',now['judge']['mcp_servers']==before['judge']['mcp_servers'])
        check(dimension+' version markers','2.0.16' in newfiles[path].decode().splitlines()[0] and '2.0.16' in newfiles[f'tests/{dimension}/prompt.md'].decode().splitlines()[0])
    for path in newfiles:
        if path=='environment/assets/instructions/editing.md':
            addition='Find may select a match while the query is being typed, or wait for the first\nnavigation command. Either way, move through matches in document order and\nwrap at the ends when navigating forward or backward.\n'
            check('Editing brief only clarifies Find convention',newfiles[path].decode().replace('\r\n','\n').replace(addition,'')==oldfiles[path].decode().replace('\r\n','\n'))
        elif path=='instruction.md' or path.startswith('environment/assets/') or path in ('tests/test.sh','tests/app-lifecycle.sh','tests/reward.toml','solution/app/server.js','solution/app/public/js/app.js'):
            check('Preserved '+path,newfiles[path]==oldfiles[path])
    check('35 criteria',total==35)
    check('Nested judge budgets with existing slack',timeouts==10550 and timeouts<12000<cfg['verifier']['timeout_sec'])
    test=newfiles['tests/test.sh'].decode()
    check('No key handling or provider remapping in test.sh',not re.search(r'OPENAI_API_KEY|OPENROUTER_API_KEY|codex login|model_provider',test))
    check('Explicit startup readiness before grading','urllib.request.urlopen' in test and test.index('Application entry ready before grading') < test.index('rewardkit --max-concurrent-agent') and 'app-lifecycle.sh start' in test)
    check('No old provider in verifier',all(b'OPENROUTER_API_KEY' not in v and b'openrouter.ai' not in v for k,v in newfiles.items() if k.startswith('tests/')))
    for path in ('solution/app/package.json','solution/app/package-lock.json'):
        package=json.loads(newfiles[path]);check('Package version '+path,package['version']=='2.0.16')
    check('Lock root version',json.loads(newfiles['solution/app/package-lock.json'])['packages']['']['version']=='2.0.16')
    for kind in ('environment','tests'):
        check(kind+' Docker version',b'io.turing.task.version="2.0.16"' in newfiles[kind+'/Dockerfile'])
        check(kind+' Docker behavior preserved',newfiles[kind+'/Dockerfile'].replace(b'2.0.16',b'2.0.15')==oldfiles[kind+'/Dockerfile'])
    check('No credential literals',not any(re.search(rb'sk-(?:or-v1-|proj-)?[A-Za-z0-9_-]{20,}',v) for v in newfiles.values()))
    changed=[k for k in newfiles if newfiles[k]!=oldfiles[k]]
archive=OUT/'patchpad-editor-v2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,content in sorted(newfiles.items()):
        i=zipfile.ZipInfo('patchpad-editor-v2/'+name,(2026,9,11,0,0,0));i.compress_type=zipfile.ZIP_DEFLATED;i.create_system=3
        i.external_attr=(0o100755 if name.endswith('.sh') else 0o100644)<<16
        z.writestr(i,content)
with zipfile.ZipFile(archive) as z:
    check('ZIP CRC',z.testzip() is None)
    check('One exact wrapper',all(p.startswith('patchpad-editor-v2/') for p in z.namelist()))
    check('Archive source hashes',all(sha(z.read('patchpad-editor-v2/'+k))==sha(v) for k,v in newfiles.items()))
manifest=dict(version='2.0.16',checks=checks,changed_files=changed,files={k:sha(v) for k,v in sorted(newfiles.items())},zip_sha256=sha(archive.read_bytes()),zip=str(archive),paid_runs=False)
(OUT/'package-audit.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'SHA256SUMS.txt').write_text(manifest['zip_sha256']+'  patchpad-editor-v2.zip\n')
print(json.dumps(dict(checks_passed=len(checks),files=len(newfiles),sha256=manifest['zip_sha256'])))
