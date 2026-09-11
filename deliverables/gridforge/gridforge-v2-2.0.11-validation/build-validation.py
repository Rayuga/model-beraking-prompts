"""Bounded exact Dockerfile builds; never contact a judge or alter proxy settings."""
from pathlib import Path
import json, subprocess
out=Path(__file__).resolve().parent
root=next(p for p in out.parents if (p/'projects').is_dir())
results=[]
for kind in ('environment','tests'):
    command=['docker','build','--progress=plain','-t',f'gridforge-preflight-{kind}:2.0.11',
             str(root/'projects/gridforge-spreadsheet-v2'/kind)]
    with (out/f'build-{kind}.log').open('w',encoding='utf-8') as log:
        try:
            r=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=180)
            result={'kind':kind,'exit_code':r.returncode,'passed':r.returncode==0}
        except subprocess.TimeoutExpired:
            result={'kind':kind,'passed':False,'error':'Exact build exceeded bounded 180-second local attempt'}
    results.append(result)
    (out/'build-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(result,flush=True)
