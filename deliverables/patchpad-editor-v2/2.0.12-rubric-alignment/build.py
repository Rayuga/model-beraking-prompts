"""Build both exact task images, saving bounded diagnostic logs without credentials."""
from pathlib import Path
import subprocess,json
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
results=[]
for kind,folder in [('agent','environment'),('verifier','tests')]:
    cmd=['docker','build','--progress=plain','-t',f'patchpad-preflight-{kind}:2.0.12',str(ROOT/'projects/patchpad-editor-v2'/folder)]
    print('Building '+kind,flush=True)
    with (OUT/(kind+'-build.log')).open('w') as log:
        try:
            p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=90)
            results.append(dict(image=kind,exit_code=p.returncode,status='PASS' if p.returncode==0 else 'FAIL'))
        except subprocess.TimeoutExpired:
            results.append(dict(image=kind,status='TIMEOUT',timeout_sec=90))
    (OUT/'build-results.json').write_text(json.dumps(results,indent=2)+'\n')
    print(results[-1],flush=True)
