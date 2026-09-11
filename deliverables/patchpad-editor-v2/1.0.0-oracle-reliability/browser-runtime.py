from pathlib import Path
import json
import subprocess
import sys

results = []
try:
    for script in sys.argv[1:]:
        subprocess.run(['bash', '/solution/solve.sh'], check=True)
        subprocess.run(['chmod', '-R', 'a+rX', '/app'], check=True)
        subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
        subprocess.run(['bash', '/tests/app-lifecycle.sh', 'start'], check=True)
        with open('/results/' + script + '.log', 'w') as log:
            run = subprocess.run(['node', '/results/' + script], stdout=log, stderr=subprocess.STDOUT, timeout=240)
        results.append({'script': script, 'exit_code': run.returncode})
        print(results[-1], flush=True)
        subprocess.run(['bash', '/tests/app-lifecycle.sh', 'stop'], check=True)
finally:
    subprocess.run(['bash', '/tests/app-lifecycle.sh', 'stop'], check=True)
    Path('/results/browser-results.json').write_text(json.dumps(results, indent=2) + '\n')
raise SystemExit(any(r['exit_code'] for r in results))
