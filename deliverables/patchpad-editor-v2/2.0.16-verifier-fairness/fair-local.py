from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,json,sys
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
app=ROOT/'run-outputs/patchpad-editor-v2/run-c7886a49-f4d4-4ef2-9954-1ddb70dda75e/patchpad-editor-v2__eSJsvj8/artifacts/app'
def run(kind):
    cmd=['docker','run','--rm','--network','none','--tmpfs','/app','--tmpfs','/logs/verifier']
    for src,dest in [(ROOT/'projects/patchpad-editor-v2/tests','/tests'),(ROOT/'projects/patchpad-editor-v2/solution','/solution'),(OUT,'/results'),(app,'/artifact')]:
        cmd+=['--mount',f'type=bind,source={src},target={dest}'+('' if dest=='/results' else ',readonly')]
    cmd+=['patchpad-preflight-tests:2.0.9','python3','/results/fair-runtime.py',kind]
    with (OUT/f'fair-{kind}.log').open('w') as log:r=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=240)
    return dict(kind=kind,exit_code=r.returncode)
negative='--negative' in sys.argv
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,['mutant-skip','mutant-nowrap'] if negative else ['golden','gemini']))
if negative:
    for r in results:
        evidence=json.loads((OUT/f'fair-find-{r["kind"]}.json').read_text())
        r['rejected_for_assertion']=r['exit_code']!=0 and any('AssertionError' in e for e in evidence['errors'])
(OUT/('negative-find-results.json' if negative else 'fair-results.json')).write_text(json.dumps(results,indent=2)+'\n')
print(results)
raise SystemExit(not all(x['rejected_for_assertion'] for x in results) if negative else any(x['exit_code'] for x in results))
