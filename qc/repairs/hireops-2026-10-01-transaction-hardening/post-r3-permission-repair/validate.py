"""Finite validation of provisional permission wording; never an app grade."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, shutil, subprocess, sys, time

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
TASK = ROOT / 'projects/hireops-recruiting-operations/hireops-recruiting-operations'
R3 = ROOT / 'qc/runs/hireops-2026-10-01-transaction-hardening-r3'
PACKAGE = ROOT / 'deliverables/hireops-recruiting-operations/2026-10-02-permission-repair'
LOCAL = OUT / 'local-attempt1'
assert not LOCAL.exists() and not PACKAGE.exists(), 'Preserve previous attempts; use a new evidence location.'
LOCAL.mkdir()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
inventory = lambda: {p.relative_to(TASK).as_posix(): sha(p) for p in TASK.rglob('*') if p.is_file()}
repair = json.loads((OUT / 'repair.json').read_text(encoding='utf-8'))
assert inventory() == repair['source_sha256']
records = []
def run(name, command, timeout=300):
    start=time.monotonic()
    result=subprocess.run(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout)
    log=LOCAL/(name+'.log'); log.write_bytes(result.stdout)
    record={'name':name,'command':command,'exit_code':result.returncode,'duration_seconds':time.monotonic()-start,
            'log':log.relative_to(ROOT).as_posix(),'log_sha256':sha(log)}
    print(json.dumps(record),flush=True)
    return record
image='hireops-verifier:20261002-permission-repair'
jobs=[('build-verifier',['docker','build','-t',image,str(TASK/'tests')]),
      ('package',[sys.executable,'-B','-X','utf8',str(ROOT/'deliverables/package_staged_candidates.py'),str(TASK),'--out',str(PACKAGE)])]
with ThreadPoolExecutor(max_workers=2) as pool: records.extend(pool.map(lambda job:run(*job),jobs))
(OUT/'initial-validation.json').write_text(json.dumps({'commands':records},indent=2)+'\n',encoding='utf-8')
assert all(r['exit_code']==0 for r in records)
image_id=json.loads(subprocess.check_output(['docker','image','inspect',image],cwd=ROOT))[0]['Id']
permission=LOCAL/'permission'; permission.mkdir()
shutil.copyfile(R3/'per-row-review/evidence/32/probe.cjs',permission/'probe.cjs')
for name in ['inspect-configured.py','archive-check.py','batch-domain.cjs']:
    shutil.copyfile(R3/'local'/name,LOCAL/name)
base=['docker','run','--rm','--network','none','-e','NODE_PATH=/usr/local/lib/node_modules','-e','LITELLM_LOCAL_MODEL_COST_MAP=True']
jobs=[
 ('permission-witness',base+['--name','hireops-provisional-permission','-v',str(TASK)+':/source:ro','-v',str(permission)+':/evidence','--entrypoint','node',image_id,'/evidence/probe.cjs']),
 ('configured-inspection',base+['--name','hireops-provisional-parser','-v',str(LOCAL)+':/evidence','--entrypoint','python3',image_id,'-B','/evidence/inspect-configured.py']),
 ('archive',base+['--name','hireops-provisional-archive','-v',str(PACKAGE)+':/candidate:ro','-v',str(LOCAL)+':/evidence','--entrypoint','python3',image_id,'-B','/evidence/archive-check.py'])]
with ThreadPoolExecutor(max_workers=3) as pool: records.extend(pool.map(lambda job:run(*job),jobs))
assert inventory() == repair['source_sha256']
report={'scope':'Finite golden/mutation browser observations, archive execution, cached image build, parser/schema/OS argument checks. No configured app grade, private checker execution, reward comparison, Oracle/model score or QC clearance.',
        'qc_status':'INCOMPLETE prior round; corrected candidate requires a complete new review when available',
        'source_sha256':inventory(),'image':image,'image_id':image_id,'commands':records,
        'passed':all(r['exit_code']==0 for r in records),'golden_unchanged':True}
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
assert report['passed']
observations=json.loads((permission/'results.json').read_text())
assert observations['completed']
outcomes=[]
for variant in observations['results']:
    assert variant['financeControl']['freshAuditorUiReadback']
    for observation in variant['observations']:
        actor=observation['actor']; name=variant['variant']
        before=json.loads((permission/f'{name}-{actor}-before.json').read_text())['change_sets']
        after=json.loads((permission/f'{name}-{actor}-after.json').read_text())['change_sets']
        holds=observation['status']==403 and observation['financialStateUnchanged'] and before==after
        assert holds == (name=='golden')
        outcomes.append({'variant':name,'actor':actor,'new_saved_preview_count':len(after)-len(before),
                         'repaired_owned_observation_holds':holds})
sys.path.insert(0,str(ROOT/'scripts'))
from qc_pipeline import preflight
structural=preflight(TASK,ROOT/'projects/webdev-task-template')
(OUT/'preflight.json').write_text(json.dumps(structural,indent=2)+'\n',encoding='utf-8')
assert structural['passed']
report['owned_observations']=outcomes
report['preflight_passed']=True
report['archive_manifest_sha256']=sha(PACKAGE/'candidate_manifest.json')
report['artifacts']={p.relative_to(ROOT).as_posix():sha(p) for p in LOCAL.rglob('*') if p.is_file()}
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':True,'observations':outcomes,'image_id':image_id,'source_files':len(inventory())}),flush=True)
