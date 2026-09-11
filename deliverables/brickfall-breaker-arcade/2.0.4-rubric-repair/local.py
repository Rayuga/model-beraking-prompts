"""Run exact-image current-source regressions offline; preserve old evidence."""
from pathlib import Path
import subprocess,json,sys
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
image='brickfall-preflight-verifier:2.0.4'
attempt=int(sys.argv[1]) if len(sys.argv)>1 else 1
cmd=['docker','run','--name',f'brickfall-rubric-local-204-attempt{attempt}','--network','none','--tmpfs','/app','--tmpfs','/logs/verifier']
for source,dest,ro in [(ROOT/'projects/brickfall-breaker-arcade/tests','/tests',True),(ROOT/'projects/brickfall-breaker-arcade/solution','/solution',True),(OUT,'/results',False),(OUT.parent/'2.2.2-rubric','/reference',True),(OUT.parent/'2.0.1-browser-gate','/gate',True)]:
    cmd+=['--mount','type=bind,source='+str(source)+',target='+dest+(',readonly' if ro else '')]
cmd += [image,'python3','/results/check.py']
with (OUT/f'regression-attempt{attempt}.log').open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,timeout=480)
(OUT/'regression-result.json').write_text(json.dumps(dict(exit_code=p.returncode,image=image,network='none',current_source=True,exact_new_image=True,paid_run=False),indent=2)+'\n')
print('Regression exit:',p.returncode);raise SystemExit(p.returncode)
