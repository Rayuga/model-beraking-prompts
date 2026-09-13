from pathlib import Path
import hashlib
import json
import subprocess

base = Path('/repo/deliverables')
suites = [
    'patchpad-editor-v2/1.0.0-public-runtime-gate-20260912/network-policy.cjs',
    'patchpad-editor-v2/1.0.0-working-content-gate/server-reads.cjs',
    'patchpad-incident-editor-validation/restart-regression.cjs',
    'patchpad-editor-v2/1.0.0-docketlight-procedures/current-failures.cjs',
]
results = []
for rel in suites:
    script = base / rel
    entry = dict(script=rel, sha256=hashlib.sha256(script.read_bytes()).hexdigest())
    log_path = Path('/results', script.name + '.log')
    try:
        subprocess.run(['bash', '/solution/solve.sh'], check=True)
        subprocess.run(['chmod', '-R', 'a+rX', '/app'], check=True)
        subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
        subprocess.run(['bash', '/tests/app-lifecycle.sh', 'start'], check=True)
        with log_path.open('x') as log:
            run = subprocess.run(['node', str(script)], stdout=log, stderr=subprocess.STDOUT, timeout=300)
        output = log_path.read_text()
        entry.update(exit_code=run.returncode, passed=run.returncode == 0 and '\nFAIL ' not in '\n' + output,
                     pass_labels=[line for line in output.splitlines() if line.startswith('PASS ')])
    except Exception as error:
        entry.update(passed=False, error=str(error))
    finally:
        subprocess.run(['bash', '/tests/app-lifecycle.sh', 'stop'], check=True)
        results.append(entry)
        Path('/results/regression-results.json').write_text(json.dumps(dict(paid_judge=False,results=results),indent=2)+'\n')
        print(json.dumps(entry), flush=True)
raise SystemExit(any(not r['passed'] for r in results))
