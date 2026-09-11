"""Bounded exact-image builds; no paid judge."""
from pathlib import Path
import subprocess,json
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
results=[]
for kind,folder in [('verifier','tests'),('agent','environment')]:
    cmd=['docker','build','--progress=plain','-t',f'brickfall-preflight-{kind}:2.0.5',str(ROOT/'projects/brickfall-breaker-arcade'/folder)]
    print('Building '+kind,flush=True)
    with (OUT/(kind+'-build.log')).open('w') as log:
        try:
            p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=60)
            results.append(dict(image=kind,exit_code=p.returncode,status='PASS' if p.returncode==0 else 'FAIL'))
        except subprocess.TimeoutExpired:
            results.append(dict(image=kind,status='TIMEOUT',timeout_sec=60))
    (OUT/'build-results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(results[-1],flush=True)
