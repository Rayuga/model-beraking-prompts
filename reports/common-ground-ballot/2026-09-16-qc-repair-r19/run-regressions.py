"""Run unchanged reference business/recovery cases against final r19 image."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
TASK = ROOT / 'projects/common-ground-ballot'
OLD = ROOT / 'reports/common-ground-ballot/2026-09-15-recovery-r17'
DRIVERS = OUT / 'regression-drivers'
DRIVERS.mkdir(exist_ok=True)
for source in OLD.glob('*'):
    if source.suffix in ('.py', '.cjs'):
        content = source.read_text(encoding='utf-8').replace('/tests/app-lifecycle.py', '/opt/common-ground-verifier/app-lifecycle.py')
        (DRIVERS / source.name).write_text(content, encoding='utf-8', newline='\n')
for name in ('test-trace.py', 'fake-codex.py'):
    content = (ROOT/'reports/common-ground-ballot/2026-09-15-verifier-repair-r18'/name).read_text(encoding='utf-8')
    content = content.replace('/tests/codex-trace.py', '/opt/common-ground-verifier/codex-trace.py')
    (DRIVERS / name).write_text(content, encoding='utf-8', newline='\n')

def check(mode):
    destination = OUT / ('regression-' + mode)
    destination.mkdir(exist_ok=True)
    command = ['docker', 'run', '--rm', '--network', 'none', '--env', 'NO_PROXY=localhost,127.0.0.1,::1', '--env', 'no_proxy=localhost,127.0.0.1,::1']
    for source,target,readonly in [(TASK/'solution','/golden',True),(TASK,'/task',True),(DRIVERS,'/validation',True),(OUT/'runtime-sources','/opt/common-ground-verifier',True),(destination,'/results',False)]:
        command += ['--mount', f'type=bind,source={source},target={target}' + (',readonly' if readonly else '')]
    command += ['ballot-verifier:20260916-r19-runtime-validation', 'python3']
    command += ['/validation/test-trace.py'] if mode == 'trace' else ['/validation/run-local.py', mode]
    result = subprocess.run(command,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=650)
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr, encoding='utf-8')
    record = {'mode':mode,'passed':result.returncode == 0,'returncode':result.returncode}
    print(json.dumps(record), result.stdout[-800:], result.stderr[-500:] if result.returncode else '',flush=True)
    return record

with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(check, sys.argv[1:] or ['recovery', 'boundaries', 'trace']))
(OUT/'regression-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
assert all(r['passed'] for r in results), results
