from pathlib import Path
import subprocess, json, sys

results=[]
try:
    for script in sys.argv[1:] or ['current-failures.cjs','reproduce.cjs','additional-regression.cjs','visual-smoke.cjs']:
        # Each independent regression suite expects its own fresh seeded report.
        subprocess.run(['bash','/solution/solve.sh'],check=True)
        subprocess.run(['chmod','-R','a+rX','/app'],check=True)
        subprocess.run(['chown','-R','65534:65534','/app'],check=True)
        subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
        with open('/results/'+script+'.log','w') as log:
            r=subprocess.run(['node','/results/'+script],stdout=log,stderr=subprocess.STDOUT,timeout=240)
        results.append(dict(script=script,exit_code=r.returncode))
        print(results[-1],flush=True)
        subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
finally:
    subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
    Path('/results/browser-results.json').write_text(json.dumps({'image':'patchpad-preflight-tests:2.0.9','scope':'Current source in a cached image; not an exact new image or Oracle run','results':results},indent=2)+'\n')
raise SystemExit(any(r['exit_code'] for r in results))
