from pathlib import Path
import json
import subprocess
import sys
import time

out = Path(__file__).resolve().parent
root = out.parents[2]
context = root / 'projects/pellmoor-job-pipeline/tests'
command = ['docker', 'build', '--progress', 'plain', '-t', 'pellmoor-r8-verifier:20260914', str(context)]
started = time.monotonic()
with (out / 'verifier-build.log').open('wb') as log:
    process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        code = process.wait(timeout=600)
        status = 'passed' if code == 0 else 'failed'
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=15)
        code = process.returncode
        status = 'timed out after 600 seconds'
result = dict(status=status, exit_code=code, elapsed_seconds=round(time.monotonic()-started,2), command=command)
(out / 'verifier-build-status.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
sys.exit(0 if status == 'passed' else 1)
