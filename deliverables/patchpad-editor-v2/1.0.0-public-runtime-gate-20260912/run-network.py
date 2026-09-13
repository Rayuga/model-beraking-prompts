from pathlib import Path
import hashlib
import json
import subprocess
import sys

attempt = int(sys.argv[1])
out = Path('/results')
script = out/'network-policy.cjs'
result = dict(attempt=attempt, script_sha256=hashlib.sha256(script.read_bytes()).hexdigest())
try:
    subprocess.run(['bash','/solution/solve.sh'],check=True)
    subprocess.run(['chmod','-R','a+rX','/app'],check=True)
    subprocess.run(['chown','-R','65534:65534','/app'],check=True)
    subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
    run = subprocess.run(['node',str(script)],capture_output=True,text=True,timeout=150)
    with (out/f'network-attempt-{attempt}-stdout.json').open('x') as log:log.write(run.stdout)
    with (out/f'network-attempt-{attempt}-stderr.txt').open('x') as log:log.write(run.stderr)
    result.update(exit_code=run.returncode,passed=run.returncode==0)
    if run.stdout:
        result['browser'] = json.loads(run.stdout)
        result['passed'] = result['passed'] and result['browser'].get('passed',False)
finally:
    subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
    with (out/f'network-attempt-{attempt}.json').open('x') as log:log.write(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(not result.get('passed',False))
