"""Run inside GridForge's verifier image, without calling a paid judge."""
import json
import os
from pathlib import Path
import subprocess

os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
from rewardkit.runner import discover

result = {'scope': 'Current 2.0.11 source in cached gridforge-v2-tests tool image; not an exact new Dockerfile build or Oracle score'}
result['status'] = 'running'
Path('/results/local-validation.json').write_text(json.dumps(result, indent=2) + '\n')
result['criteria'] = {d.name: len(d.criteria) for d in discover('/tests')}
assert result['criteria'] == {'render': 2, 'constraints': 2, 'functional': 36, 'polish': 4}
for script in [*Path('/tests').glob('*.sh'), Path('/solution/solve.sh')]:
    subprocess.run(['bash', '-n', str(script)], check=True)
for script in Path('/solution/app').rglob('*.js'):
    subprocess.run(['node', '--check', str(script)], check=True)
subprocess.run(['bash', '/tests/test.sh'], check=True)
noop = json.loads(Path('/logs/verifier/reward.json').read_text())
assert noop['reward'] == 0 and noop['no_op'] == 1
result['empty_submission'] = noop

for script in ['/validation/browser-smoke.cjs', '/shared/gridforge-oracle-regression.cjs',
               '/validation/interaction-regression.cjs', '/validation/collaboration-regression.cjs',
               '/validation/focused-regressions.cjs']:
    subprocess.run(['bash', '/solution/solve.sh'], check=True)
    subprocess.run(['chmod', '-R', 'a+rX', '/app'], check=True)
    subprocess.run(['chown', '-R', '65534:65534', '/app'], check=True)
    Path('/tmp/gridforge-v2-submission').mkdir(exist_ok=True)
    subprocess.run(['chown', '65534:65534', '/tmp/gridforge-v2-submission'], check=True)
    subprocess.run(['bash', '/tests/app-control.sh', 'start'], check=True)
    try:
        subprocess.run(['node', script, 'gridforge'], check=True, timeout=240,
                       env=dict(os.environ, REGRESSION_OUTPUT='/results/oracle-regression.json'))
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        result.update(status='failed', failed_script=script, error=str(error))
        Path('/results/local-validation.json').write_text(json.dumps(result, indent=2) + '\n')
        raise
    finally:
        subprocess.run(['bash', '/tests/app-control.sh', 'stop'], check=True)

result['smoke'] = json.loads(Path('/results/gridforge-smoke.json').read_text())
result['previous_oracle_failures'] = json.loads(Path('/results/oracle-regression.json').read_text())
result['interaction_regression'] = json.loads(Path('/results/interaction-regression.json').read_text())
result['collaboration_regression'] = json.loads(Path('/results/collaboration-regression.json').read_text())
result['focused_regression'] = json.loads(Path('/results/focused-regression.json').read_text())
result['status'] = 'passed'
Path('/results/local-validation.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
