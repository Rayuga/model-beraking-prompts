"""Unpaid, disposable-container validation; never invokes a model."""
import json
from pathlib import Path
import subprocess

out = Path('/results')
completed = []
def run(name, args, timeout=600):
    print('START ' + name, flush=True)
    with (out / (name + '.log')).open('w') as log:
        subprocess.run(args, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=timeout)
    completed.append(name)
    (out / 'release-progress.json').write_text(json.dumps(completed, indent=2))
    print('PASS ' + name, flush=True)

run('local-validation', ['python3', '/validation/validate-local.py'])
run('browser-variants', ['python3', '/results/run.py'])
# An independent clean seed for the broader additional regression suite.
subprocess.run(['bash', '/solution/solve.sh'], check=True)
subprocess.run(['chmod', '-R', 'a+rX', '/app'], check=True)
subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
subprocess.run(['bash', '/tests/app-lifecycle.sh', 'start'], check=True)
try:
    run('additional-regression', ['node', '/previous/additional-regression.cjs'])
finally:
    subprocess.run(['bash', '/tests/app-lifecycle.sh', 'stop'], check=True)
run('harness-integration', ['python3', '/validation/validate-harness.py'])
run('coverage-negative-controls', ['python3', '/validation/validate-coverage-mutants.py'])
for name in ('browser-variants', 'additional-regression', 'oracle-failures-regression'):
    data = json.loads((out / (name + '.json')).read_text())
    assert all(c['passed'] for c in data['results']), name
print('PASS release validation; NOT a platform QC or Oracle grade', flush=True)
