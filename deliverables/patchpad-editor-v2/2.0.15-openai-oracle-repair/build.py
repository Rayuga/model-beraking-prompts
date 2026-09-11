"""Build both exact release images concurrently; no model calls."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json, subprocess
OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
def build(pair):
    kind, folder = pair
    image = f'patchpad-preflight-{kind}:2.0.15'
    with (OUT / f'{kind}-build.log').open('w') as log:
        try:
            p = subprocess.run(['docker','build','--progress=plain','-t',image,str(ROOT/'projects/patchpad-editor-v2'/folder)],stdout=log,stderr=subprocess.STDOUT,timeout=600)
            result = dict(image=image,status='PASS' if p.returncode==0 else 'FAIL',exit_code=p.returncode)
        except subprocess.TimeoutExpired:
            result = dict(image=image,status='TIMEOUT',timeout_sec=600)
    print(result,flush=True)
    return result
with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(build,[('agent','environment'),('verifier','tests')]))
(OUT/'build-results.json').write_text(json.dumps(results,indent=2)+'\n')
