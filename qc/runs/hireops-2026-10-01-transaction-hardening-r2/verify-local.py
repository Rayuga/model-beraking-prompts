"""Local observations on the frozen candidate, no provider call or score claim."""
from pathlib import Path
import subprocess,concurrent.futures,json,hashlib,time,shutil
ROOT=Path(__file__).resolve().parents[3];RUN=Path(__file__).resolve().parent;OUT=RUN/'local';OUT.mkdir(exist_ok=True)
M=json.loads((RUN/'manifest.json').read_text());T=ROOT/M['cache']/'task';A=ROOT/'qc/repairs/hireops-2026-10-01-transaction-hardening'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def command(name,args,timeout=240):
 start=time.monotonic();p=subprocess.run(args,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout);log=OUT/(name+'.log');log.write_bytes(p.stdout)
 record={'name':name,'command':args,'exit_code':p.returncode,'duration_seconds':time.monotonic()-start,'log':log.relative_to(ROOT).as_posix(),'log_sha256':sha(log)};print(json.dumps(record),flush=True);return record
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 records.extend(pool.map(lambda x:command(*x),[('build-agent',['docker','build','-t','hireops-agent:20261001-hard-r2',str(T/'environment')]),('build-verifier',['docker','build','-t','hireops-verifier:20261001-hard-r2',str(T/'tests')])]))
assert all(r['exit_code']==0 for r in records)
old=ROOT/'qc/runs/hireops-2026-10-01-handoff-repairs/local-final'
for n in ['inspect-configured.py','gate-witness.cjs']:
 s=(old/n).read_text(encoding='utf-8').replace("name:'Dashboard',exact:true","name:'Coordinated Changes',exact:true")
 (OUT/n).write_text(s,encoding='utf-8',newline='\n')
s=(ROOT/'scripts/check_hireops_mcp.cjs').read_text(encoding='utf-8').replace("const root = path.resolve(__dirname, '..');","const root = '/work';").replace("name:'Dashboard',exact:true","name:'Coordinated Changes',exact:true").replace("localVariation: 'Windows Chrome executable in place of template Linux Chromium'","localVariation: 'None: pinned Linux Chromium executable and MCP flags'")
# Exercise response loss through the actual MCP execution realm as Polish requires.
marker="  await tool('browser_close', {});"
s=s.replace(marker,"""  await run('forward real operation then lose response, preserve page, retry mechanism available', `async (page) => {
    let forwarded=0, realStatus;
    const handler=async route=>{ if(route.request().method()!=='POST')return route.continue(); const response=await route.fetch(); forwarded++;realStatus=response.status();await route.abort('failed'); };
    await page.route('**/api/requisitions',handler);
    try {
      await page.locator('#req-id').fill('MCP-lost-response');await page.locator('#req-title').fill('MCP response loss');
      await page.getByRole('button',{name:'Create requisition',exact:true}).click();await page.locator('#flash .error').waitFor();
    } finally {await page.unroute('**/api/requisitions',handler);}
    const response=await page.context().request.get('${base}/api/requisitions/MCP-lost-response');
    if(forwarded!==1||realStatus!==200||response.status()!==200)throw new Error('Response-loss mechanism did not forward exactly one real successful operation');
    return {forwarded,realStatus,browserObservedFailure:true,persistedDespiteLostResponse:true};
  }`);
"""+marker)
(OUT/'mcp.cjs').write_text(s,encoding='utf-8',newline='\n')
shutil.copyfile(A/'legacy-ui.cjs',OUT/'legacy-ui.cjs')
for n in ['batch-domain.cjs','batch-ui.cjs']:
 s=(A/n).read_text(encoding='utf-8-sig').replace('/evidence/batch-domain-attempt2','/evidence/batch-domain').replace('/evidence/batch-ui-attempt2','/evidence/batch-ui')
 (OUT/n).write_text(s,encoding='utf-8',newline='\n')
shell=(old/'run-local.sh').read_text(encoding='utf-8').replace('node "/work/scripts/check_hireops_$1.cjs" "/evidence/$1"','if [ "$1" = domain ]; then node /work/scripts/check_hireops_domain.cjs /evidence/domain; else node "/evidence/$1.cjs" "/evidence/$1"; fi')
(OUT/'run-local.sh').write_text(shell,encoding='utf-8',newline='\n')
base=['docker','run','--rm','--network','none','-e','NODE_PATH=/usr/local/lib/node_modules','-e','LITELLM_LOCAL_MODEL_COST_MAP=True','-v',str(OUT)+':/evidence','-v',str(T/'solution')+':/solution:ro']
image='hireops-verifier:20261001-hard-r2';jobs=[]
for kind in ['domain','legacy-ui','mcp']:
 jobs.append((kind,base+['-v',str(ROOT/'scripts')+':/work/scripts:ro','-v',str(T)+':/work/projects/hireops-recruiting-operations/hireops-recruiting-operations:ro','--entrypoint','bash',image,'/evidence/run-local.sh',kind]))
for kind in ['batch-domain','batch-ui','gate-witness']:
 jobs.append((kind,base+['--entrypoint','node',image,'/evidence/'+kind+'.cjs']))
jobs.append(('configured-inspection',base+['--entrypoint','python3',image,'/evidence/inspect-configured.py']))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:records.extend(pool.map(lambda x:command(*x),jobs))
current={p.relative_to(T).as_posix():sha(p) for p in T.rglob('*') if p.is_file()};assert current==M['inputs']['task']
images={n:json.loads(subprocess.check_output(['docker','image','inspect',n]))[0]['Id'] for n in ['hireops-agent:20261001-hard-r2',image]}
report={'kind':'Local scripted golden, MCP feasibility, parser/schema/OS launch and fixture evidence only. No full configured grading, timing, reward discrimination, Oracle or target-builder score.','input_sha256':M['input_sha256'],'source_sha256':current,'source_unchanged':True,'images':images,'commands':records,'passed':all(r['exit_code']==0 for r in records)}
(RUN/'verification-local.json').write_text(json.dumps(report,indent=2)+'\n')
index=json.loads((RUN/'raw-evidence-index.json').read_text());index['entries'].append({'path':(RUN/'verification-local.json').relative_to(ROOT).as_posix(),'sha256':sha(RUN/'verification-local.json'),'scope':report['kind']})
for p in OUT.rglob('*'):
 if p.is_file() and p.suffix in ['.json','.jsonl','.log','.cjs','.py','.sh','.png']:
  index['entries'].append({'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'scope':'Frozen candidate local artifact; verify driver and source bindings. No provider grade.'})
(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
assert report['passed']
