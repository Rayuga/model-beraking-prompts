from pathlib import Path
import concurrent.futures,hashlib,json,shutil,subprocess,time
ROOT=Path(__file__).resolve().parents[3];RUN=Path(__file__).resolve().parent;OUT=RUN/'local';OLD=ROOT/'qc/runs/hireops-2026-10-01-transaction-hardening-r1/local'
M=json.loads((RUN/'manifest.json').read_text());T=ROOT/M['cache']/'task';D=ROOT/'deliverables/hireops-recruiting-operations/2026-10-01-hardening-r2'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for n in ['install-lifecycle.py','archive-check.py','batch-witnesses.cjs','batch-boundaries.cjs']:shutil.copyfile(OLD/n,OUT/n)
base=['docker','run','--rm','--network','none','-e','NODE_PATH=/usr/local/lib/node_modules','-e','LITELLM_LOCAL_MODEL_COST_MAP=True','-v',str(OUT)+':/evidence','-v',str(T/'solution')+':/solution:ro']
image='hireops-verifier:20261001-hard-r2'
jobs=[('install-lifecycle',base+['--entrypoint','python3',image,'/evidence/install-lifecycle.py']),('archive',base+['-v',str(D)+':/candidate:ro','--entrypoint','python3',image,'/evidence/archive-check.py'])]
for n in ['batch-witnesses','batch-boundaries']:jobs.append((n,base+['--entrypoint','node',image,'/evidence/'+n+'.cjs']))
def run(job):
 name,args=job;t=time.monotonic();p=subprocess.run(args,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=240);log=OUT/(name+'.log');log.write_bytes(p.stdout)
 r={'name':name,'command':args,'exit_code':p.returncode,'duration_seconds':time.monotonic()-t,'log':log.relative_to(ROOT).as_posix(),'log_sha256':sha(log)};print(json.dumps(r),flush=True);return r
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:records=list(pool.map(run,jobs))
assert {p.relative_to(T).as_posix():sha(p) for p in T.rglob('*') if p.is_file()}==M['inputs']['task']
report={'scope':'Finite local installer, actual normal restart, extracted archive and mutation/boundary observations; no configured provider grade or measured reward comparison.','input_sha256':M['input_sha256'],'source_unchanged':True,'source_sha256':M['inputs']['task'],'commands':records,'passed':all(r['exit_code']==0 for r in records)}
(RUN/'verification-extra.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
index=json.loads((RUN/'raw-evidence-index.json').read_text());entries={e['path']:e for e in index['entries']}
for p in [RUN/'verification-extra.json',Path(__file__)]+[p for p in OUT.rglob('*') if p.is_file() and p.suffix in ['.json','.log','.cjs','.py','.sh']]:
 rel=p.relative_to(ROOT).as_posix();entries[rel]={'path':rel,'sha256':sha(p),'scope':'Current candidate local raw artifact. Finite behavior, tool or parser observation only; no full configured judge/timing/reward measurement.'}
index['entries']=list(entries.values());(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf8')
assert report['passed']
