from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, shutil, subprocess, sys
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2];attempt=int(sys.argv[1])
def run(kind):
    dest=OUT/f'{kind}-attempt-{attempt}';dest.mkdir(exist_ok=False)
    for name in ['runtime.py','server-reads.cjs']:shutil.copy2(OUT/name,dest/name)
    cmd=['docker','run','--rm','--network','none','--tmpfs','/app','--tmpfs','/logs/verifier','--shm-size','512m','-e','REVIEW_KIND='+kind]
    for src,target in [(ROOT/'projects/patchpad-editor-v2/tests','/tests'),(ROOT/'projects/patchpad-editor-v2/solution','/solution'),(ROOT/'projects/patchpad-editor-v2/environment/assets','/assets'),(dest,'/results')]:
        cmd+=['--mount',f'type=bind,source={src},target={target}'+('' if target=='/results' else ',readonly')]
    cmd+=['patchpad-preflight-tests:2.0.9','python3','/results/runtime.py',kind]
    with (dest/'run.log').open('x',encoding='utf-8') as log:r=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=360)
    return dict(kind=kind,exit_code=r.returncode)
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,['golden','html']))
(OUT/f'local-results-{attempt}.json').write_text(json.dumps(results,indent=2)+'\n');print(results)
raise SystemExit(any(r['exit_code'] for r in results))
