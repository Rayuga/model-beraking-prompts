from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, subprocess
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2];TASK=ROOT/'projects/brickfall-breaker-arcade'
def build(part):
    with (OUT/f'build-{part}.log').open('x',encoding='utf-8') as log:
        try:
            r=subprocess.run(['docker','build','--progress=plain','-t',f'brickfall-standard-{part}:1.0.0','-f',str(TASK/part/'Dockerfile'),str(TASK/part)],stdout=log,stderr=subprocess.STDOUT,timeout=240)
            return dict(image=part,exit_code=r.returncode,passed=r.returncode==0)
        except subprocess.TimeoutExpired:return dict(image=part,passed=False,timeout_seconds=240)
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(build,['environment','tests']))
(OUT/'build-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8');print(results)
