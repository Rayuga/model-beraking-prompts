from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
TASK = OUT / 'frozen/common-ground-ballot' if '--frozen' in sys.argv else ROOT / 'projects/common-ground-ballot'
IMAGES = {'agent': 'ballot-agent:20260915-r17', 'verifier': 'ballot-verifier:20260915-r17'}
if '--cached-dependencies' in sys.argv:
    IMAGES = {key: value + '-local' for key, value in IMAGES.items()}


def build(kind):
    folder = TASK / ('environment' if kind == 'agent' else 'tests')
    dockerfile = OUT / ('Dockerfile.local-' + kind) if '--cached-dependencies' in sys.argv else folder / 'Dockerfile'
    command = ['docker', 'build', '-t', IMAGES[kind], '-f', str(dockerfile)]
    if '--direct-network' in sys.argv:
        for name in ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']:
            command += ['--build-arg', name + '=']
    result = subprocess.run(command + [str(folder)], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
    suffix = '-cached' if '--cached-dependencies' in sys.argv else '-direct' if '--direct-network' in sys.argv else ''
    (OUT / f'build-{kind}{suffix}.log').write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    print('build', kind, 'exit', result.returncode, flush=True)
    if result.returncode:
        print(result.stderr[-3500:], flush=True)
    assert result.returncode == 0
    return {'phase': 'build', 'kind': kind, 'passed': True}


def check(mode):
    destination = OUT / ('validation-' + mode + ('-gpt' if '--gpt' in sys.argv else ''))
    destination.mkdir(exist_ok=True)
    command = ['docker', 'run', '--rm', '--network', 'none', '--env', 'NO_PROXY=localhost,127.0.0.1,::1', '--env', 'no_proxy=localhost,127.0.0.1,::1']
    for source, target, readonly in [(TASK / 'solution', '/golden', True), (TASK, '/task', True), (OUT, '/validation', True), (destination, '/results', False)]:
        command += ['--mount', f'type=bind,source={source},target={target}' + (',readonly' if readonly else '')]
    if '--gpt' in sys.argv:
        model = ROOT / 'run-outputs/common-ground-ballot/run-d9981dfb-d091-4621-b264-b4ef078bad3b/common-ground-ballot__Vjmb2mT/artifacts/app'
        command += ['--env','STRICT_APP=gpt','--mount',f'type=bind,source={model},target=/model,readonly']
    command += [IMAGES['verifier'], 'python3', '/validation/run-local.py', mode]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    (destination / 'runner.log').write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    print(mode, 'exit', result.returncode, result.stdout[-2800:], result.stderr[-1500:] if result.returncode else '', flush=True)
    assert result.returncode == 0
    return {'phase': 'check', 'mode': mode, 'passed': True}


results = []
for phase in [value for value in sys.argv[1:] if not value.startswith('--')] or ['build', 'checks']:
    with ThreadPoolExecutor(max_workers=2) as pool:
        results.extend(pool.map(build, IMAGES) if phase == 'build' else pool.map(check, ['browser', 'runtime', 'harness'] if phase == 'checks' else [phase]))
(OUT / ('validation-' + '-'.join(sys.argv[1:] or ['all']) + '.json')).write_text(json.dumps(results, indent=2) + '\n')
