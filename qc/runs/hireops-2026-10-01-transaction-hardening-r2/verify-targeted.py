from pathlib import Path
import json,subprocess,time,hashlib
RUN=Path(__file__).resolve().parent;ROOT=RUN.parents[2];M=json.loads((RUN/'manifest.json').read_text());L=RUN/'local';T=ROOT/M['cache']/'task'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
for name in ['targeted-golden','partial-recovery']:
    cmd=['docker','run','--rm','--network','none','-e','NODE_PATH=/usr/local/lib/node_modules','-v',str(L)+':/evidence','-v',str(T/'solution')+':/solution:ro','--entrypoint','node','hireops-verifier:20261001-hard-r2','/evidence/'+name+'.cjs']
    start=time.monotonic();r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8');log=L/(name+'.log');log.write_text(r.stdout+r.stderr,encoding='utf-8')
    records.append({'name':name,'command':cmd,'exit_code':r.returncode,'duration_seconds':time.monotonic()-start,'driver_sha256':sha(L/(name+'.cjs')),'log':log.relative_to(ROOT).as_posix(),'log_sha256':sha(log)})
    print(name,r.returncode,flush=True)
assert all(sha(T/p)==h and sha(ROOT/M['task']/p)==h for p,h in M['inputs']['task'].items())
result={'input_sha256':M['input_sha256'],'source_unchanged':True,'source_sha256':M['inputs']['task'],'scope':'Targeted golden UI observations and an isolated deliberate partial implementation. No configured grading or measured reward.','commands':records,'passed':all(x['exit_code']==0 for x in records)}
(RUN/'verification-targeted.json').write_text(json.dumps(result,indent=2)+'\n')
index=json.loads((RUN/'raw-evidence-index.json').read_text());entries={x['path']:x for x in index['entries']}
paths=[RUN/'verification-targeted.json',Path(__file__),L/'build-targeted-probes.py']
for name in ['targeted-golden','partial-recovery']:
    paths.extend([L/(name+'.cjs'),L/(name+'.log')]);paths.extend(p for p in (L/name).rglob('*') if p.is_file())
for p in paths:entries[p.relative_to(ROOT).as_posix()]={'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'scope':'Targeted finite UI/mutant observation; not configured grading, score or workload.'}
index['entries']=list(entries.values());(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
raise SystemExit(0 if result['passed'] else 1)
