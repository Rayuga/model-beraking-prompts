"""Reproduce exported GPT startup under the verifier's clean unprivileged env."""
from pathlib import Path
import json,subprocess
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
ART=ROOT/'run-outputs/patchpad-editor-v2/run-bfe69a1c-6c47-4471-9505-a94b964717f7/patchpad-editor-v2__qnt5sss/artifacts/app'
code="""import shutil,os,subprocess,json
from pathlib import Path
shutil.copytree('/artifact','/app',dirs_exist_ok=True)
for p in [Path('/app'),*Path('/app').rglob('*')]:
 os.chown(p,65534,65534);os.chmod(p,0o755 if p.is_dir() else 0o644)
env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':'/tmp','PORT':'3000','HOST':'0.0.0.0','SEED_PATH':'/assets/incident_seed.json'}
p=subprocess.run(['setpriv','--reuid=65534','--regid=65534','--clear-groups','sh','-c','cd /app && exec npm start'],env=env,text=True,capture_output=True,timeout=25)
print(json.dumps({'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'scope':'Exported model artifact unchanged, clean unprivileged verifier-like startup'}))
"""
r=subprocess.run(['docker','run','--rm','--network','none','--read-only','--tmpfs','/app','--tmpfs','/tmp','--mount','type=bind,source='+str(ART)+',target=/artifact,readonly','patchpad-preflight-tests:2.0.9','python3','-c',code],text=True,capture_output=True,timeout=45)
assert r.returncode==0,r.stderr
d=json.loads(r.stdout);assert d['exit_code']!=0
(OUT/'gpt-startup.json').write_text(json.dumps(d,indent=2)+'\n')
print(json.dumps(d))
