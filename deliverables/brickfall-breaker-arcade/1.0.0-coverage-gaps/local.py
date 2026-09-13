from pathlib import Path
import json, shutil, subprocess, sys
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
attempt=int(sys.argv[1]) if len(sys.argv)>1 else 1
results=OUT/f'attempt-{attempt}'
results.mkdir(exist_ok=False)
for p in OUT.iterdir():
    if p.suffix=='.cjs' or p.name in ('check.py','expected-digests.json'):shutil.copy2(p,results/p.name)
cmd=['docker','run','--rm','--network','none','--tmpfs','/app','--tmpfs','/logs/verifier']
for src,dest in [(ROOT/'projects/brickfall-breaker-arcade/tests','/tests'),(ROOT/'projects/brickfall-breaker-arcade/solution','/solution'),(results,'/results')]:
    cmd+=['--mount',f'type=bind,source={src},target={dest}'+('' if dest=='/results' else ',readonly')]
cmd+=['brickfall-preflight-verifier:2.0.4','python3','/results/check.py']
with (OUT/f'local-attempt-{attempt}.log').open('x',encoding='utf-8') as log:result=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=750)
print('Local attempt',attempt,'exit',result.returncode);raise SystemExit(result.returncode)
