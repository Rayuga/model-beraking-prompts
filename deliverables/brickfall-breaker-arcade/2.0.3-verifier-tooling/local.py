"""Run current Brickfall regression offline, preserving historical evidence."""
from pathlib import Path
import json,subprocess
OUT=Path(__file__).resolve().parent
old=json.loads(subprocess.check_output(['docker','inspect','brickfall-lead-local-202'],text=True))[0]
cmd=['docker','run','--name','brickfall-tooling-exact-203','--network','none','--tmpfs','/app','--tmpfs','/logs/verifier']
for m in old['Mounts']:
    source=str(OUT) if m['Destination']=='/results' else m['Source']
    mount='type=bind,source='+source+',target='+m['Destination']
    if not m['RW']:mount+=',readonly'
    cmd+=['--mount',mount]
cmd+=['brickfall-preflight-verifier:2.0.3','python3','/reference/local-checks.py']
with (OUT/'regression.log').open('w') as log:
    p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=360)
(OUT/'regression-result.json').write_text(json.dumps({'exit_code':p.returncode,'image':'brickfall-preflight-verifier:2.0.3','network':'none','current_source':True,'exact_new_image':True,'paid_run':False},indent=2)+'\n')
print('Offline current-source regression exit:',p.returncode)
raise SystemExit(p.returncode)
