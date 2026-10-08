from pathlib import Path
import concurrent.futures,hashlib,json,subprocess,time,shutil
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent;OUT=HERE/'post-r1-local'
TASK=ROOT/'projects/hireops-recruiting-operations/hireops-recruiting-operations'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={p.relative_to(TASK).as_posix():sha(p) for p in TASK.rglob('*') if p.is_file()}
shutil.copyfile(ROOT/'qc/runs/hireops-2026-10-01-transaction-hardening-r1/local/batch-domain.cjs',OUT/'batch-domain.cjs')
image='hireops-verifier:20261001-hard-r1'
base=['docker','run','--rm','--network','none','-e','NODE_PATH=/usr/local/lib/node_modules','-v',str(TASK/'solution')+':/solution:ro','-v',str(OUT)+':/evidence','-v',str(HERE)+':/drivers:ro','--entrypoint','node',image]
jobs=[('audit-history',base+['/drivers/audit-history-regression.cjs','/evidence/audit-history-regression']),('batch-domain',base+['/evidence/batch-domain.cjs'])]
def run(job):
 name,args=job;t=time.monotonic();p=subprocess.run(args,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=240);log=OUT/(name+'.log');log.write_bytes(p.stdout)
 r={'name':name,'command':args,'exit_code':p.returncode,'seconds':time.monotonic()-t,'log':log.relative_to(ROOT).as_posix(),'sha256':sha(log)};print(json.dumps(r),flush=True);return r
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,jobs))
after={p.relative_to(TASK).as_posix():sha(p) for p in TASK.rglob('*') if p.is_file()};assert before==after
record={'scope':'Post-reconciliation golden API/browser regression and coordinated-domain checks only; no configured grade','source_sha256':before,'source_unchanged':True,'runtime_image':json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]['Id'],'commands':results,'passed':all(r['exit_code']==0 for r in results)}
(OUT/'verification.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
assert record['passed']
