from pathlib import Path
import json
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / 'deliverables/pellmoor-job-pipeline/1.0.0-r10-static-repair-20260915/task/pellmoor-job-pipeline'
OUT = HERE / 'golden-validation'
command = ['docker', 'run', '--rm', '--name', 'pellmoor-r10-golden', '--network', 'none', '--mount', f'type=bind,source={SOURCE.as_posix()},target=/source,readonly', '--mount', f'type=bind,source={OUT.as_posix()},target=/evidence', '--entrypoint', '/bin/bash', 'pellmoor-tests:2.0.3', '/evidence/golden-setup.sh']
start = time.monotonic()
with (OUT / 'execution.log').open('w', encoding='utf-8') as log:
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    for line in process.stdout:
        log.write(line)
        log.flush()
        print(line, end='', flush=True)
    code = process.wait()
report = {'exit_code': code, 'elapsed_seconds': round(time.monotonic() - start, 2), 'command': command, 'scope': 'Frozen r10 golden browser/product regressions using cached image, actual lifecycle runner and synthetic RewardKit wrapper; not hosted scores'}
(OUT / 'execution-status.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report), flush=True)
raise SystemExit(code)
