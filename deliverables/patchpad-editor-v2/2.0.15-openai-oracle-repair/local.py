"""Launch fresh offline regressions without touching historical result files."""
from pathlib import Path
import json,subprocess,sys
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
old=json.loads(subprocess.check_output(['docker','inspect','patchpad-lead-local-2010'],text=True))[0]
attempt=int(sys.argv[1]) if len(sys.argv)>1 else 1
cmd=['docker','run','--name',f'patchpad-openai-recheck-2015-{attempt}','--network','none','--tmpfs','/app','--tmpfs','/logs/verifier']
for m in old['Mounts']:
    source=str(OUT) if m['Destination']=='/results' else m['Source']
    mount='type=bind,source='+source+',target='+m['Destination']
    if not m['RW']:mount+=',readonly'
    cmd+=['--mount',mount]
# This old image has the same restored judge dependency versions; it is not
# presented as a fresh build of the new Dockerfile.
cmd+=['--mount','type=bind,source='+str(OUT/'validate-harness.py')+',target=/validation/validate-harness.py,readonly']
cmd+=['--mount','type=bind,source='+str(OUT/'additional-regression.cjs')+',target=/previous/additional-regression.cjs,readonly']
cmd+=['patchpad-preflight-tests:2.0.9','python3','/results/validation.py']
with (OUT/f'regression-{attempt}.log').open('w') as log:
    p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=900)
(OUT/'regression-result.json').write_text(json.dumps({'exit_code':p.returncode,'image':'patchpad-preflight-tests:2.0.9','network':'none','current_source':True,'exact_new_image':False,'paid_run':False},indent=2)+'\n')
print('Offline current-source regression exit:',p.returncode)
raise SystemExit(p.returncode)
