from pathlib import Path
import subprocess,json,time,concurrent.futures
root=Path.cwd();out=root/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27'
solution=root/'projects/colderwater-playground-devtools/solution';task=solution.parent
def run(command,folder,filename,timeout=300):
 start=time.monotonic();r=subprocess.run(command,text=True,capture_output=True,encoding='utf-8',timeout=timeout)
 (folder/filename).write_text(r.stdout+r.stderr,encoding='utf-8')
 result={'returncode':r.returncode,'elapsed_seconds':round(time.monotonic()-start,3),'command':command,'log':str(folder/filename)}
 print(json.dumps(result),flush=True)
 return result
def installer():
 folder=out/'installer'
 return run(['docker','run','--rm','--name','colderwater-fullqc-installer-20260927','--network','none','--mount',f'type=bind,source={solution},target=/solution,readonly','--mount',f'type=bind,source={folder},target=/work','colderwater-agent:20260926-followup','node','/work/probe.cjs'],folder,'execution.log')
def restart():
 folder=out/'restart';(folder/'logs').mkdir(exist_ok=True)
 return run(['docker','run','--rm','--name','colderwater-fullqc-restart-20260927','--network','none','--mount',f'type=bind,source={task},target=/source-task,readonly','--mount',f'type=bind,source={folder},target=/local-evidence,readonly','--mount',f'type=bind,source={folder/"logs"},target=/logs/verifier','-e','HARNESS_CASE=golden','-e','HARNESS_SECRET=synthetic-not-private','-e','REWARDKIT_JUDGE=local-harness-stub','-e','REWARDKIT_MODEL=not-a-real-model','colderwater-verifier:20260926-followup','bash','/local-evidence/harness_boot.sh'],folder,'execution.log')
def negatives():
 folder=out/'negative-gates';results=[]
 for mode in ['inert','client-library']:
  name='colderwater-fullqc-negative-'+mode+'-20260927'
  subprocess.run(['docker','run','-d','--name',name,'--network','none','--mount',f'type=bind,source={folder},target=/fixture,readonly','-e','MOCK_MODE='+mode,'colderwater-agent:20260926-followup','node','/fixture/server.cjs'],check=True,capture_output=True)
  try:
   results.append(run(['docker','run','--rm','--name',name+'-browser','--network','container:'+name,'--mount',f'type=bind,source={folder},target=/fixture,readonly','--mount',f'type=bind,source={folder},target=/evidence','-e','MOCK_MODE='+mode,'colderwater-verifier:20260926-followup','node','/fixture/browser-proof.cjs'],folder,mode+'-execution.log'))
  finally:subprocess.run(['docker','rm','-f',name],check=True,capture_output=True)
 return results
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:
 tasks={key:pool.submit(fn)for key,fn in [('installer',installer),('restart',restart),('negative_gates',negatives)]}
 results={key:future.result()for key,future in tasks.items()}
(out/'lifecycle-negative-executions.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
assert all(r['returncode']==0 for v in results.values() for r in (v if isinstance(v,list)else[v])),results
