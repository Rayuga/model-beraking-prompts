from pathlib import Path
import json,hashlib,subprocess,time
RUN=Path(__file__).resolve().parent;ROOT=RUN.parents[2];M=json.loads((RUN/'manifest.json').read_text());OUT=RUN/'local/uncached-inspection';OUT.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
driver=OUT/'inspect-configured.py';driver.write_bytes((RUN/'local/inspect-configured.py').read_bytes())
image='hireops-verifier:20261001-hard-r2-uncached'
cmd=['docker','run','--rm','--network','none','-e','LITELLM_LOCAL_MODEL_COST_MAP=True','-v',str(OUT)+':/evidence','--entrypoint','python3',image,'/evidence/inspect-configured.py']
start=time.monotonic();r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8');log=OUT/'run.log';log.write_text(r.stdout+r.stderr,encoding='utf-8')
result={'input_sha256':M['input_sha256'],'scope':'Installed parser/schema/OS argv and CLI version checks in the uncached-layer verifier image. No provider grading.','image':image,'image_id':json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]['Id'],'command':cmd,'exit_code':r.returncode,'duration_seconds':time.monotonic()-start,'driver_sha256':sha(driver),'log':log.relative_to(ROOT).as_posix(),'log_sha256':sha(log)}
(RUN/'verification-uncached-inspection.json').write_text(json.dumps(result,indent=2)+'\n')
index=json.loads((RUN/'raw-evidence-index.json').read_text());entries={x['path']:x for x in index['entries']}
for p in [Path(__file__),RUN/'verification-uncached-inspection.json',*(p for p in OUT.rglob('*') if p.is_file())]:
    entries[p.relative_to(ROOT).as_posix()]={'path':p.relative_to(ROOT).as_posix(),'sha256':sha(p),'scope':'Installed parser/schema/argv and versions in uncached image; no grade.'}
index['entries']=list(entries.values());(RUN/'raw-evidence-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps(result));raise SystemExit(r.returncode)
