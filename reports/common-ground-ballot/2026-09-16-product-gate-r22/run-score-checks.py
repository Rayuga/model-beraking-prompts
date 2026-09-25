from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
for script in ('check-order-and-score.py', 'check-observed-controls.py'):
    command = ['docker', 'run', '--rm', '--network', 'none',
               '--env', 'LITELLM_LOCAL_MODEL_COST_MAP=True',
               '--mount', f'type=bind,source={HERE},target=/validation,readonly',
               '--mount', f'type=bind,source={HERE / "order-score"},target=/results',
               'ballot-verifier:20260916-r22-runtime-validation',
               'python3', '/validation/' + script]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', timeout=60)
    (HERE / 'order-score' / (script + '.log')).write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    print(script, result.returncode, result.stdout[-2800:], result.stderr[-1500:] if result.returncode else '', flush=True)
    assert result.returncode == 0
