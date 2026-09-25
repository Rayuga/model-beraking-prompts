from pathlib import Path
import hashlib
import json
import subprocess
import sys
import time

out = Path(__file__).resolve().parent
root = out.parents[2]
frozen = out.parent / '1.0.0-r8-reliability-20260914'
archive = frozen / 'pellmoor-job-pipeline.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == 'e2cb22b029d958b29bc817003149236a0b0baa51803982fbee1d69ee171c81af'
context = frozen / 'task/pellmoor-job-pipeline/tests'
command = ['docker', 'build', '--progress', 'plain', '-t', 'pellmoor-r8-verifier:20260915', str(context)]
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
result = dict(status=status, exit_code=code, elapsed_seconds=round(time.monotonic()-started,2), command=command, frozen_zip_sha256=hashlib.sha256(archive.read_bytes()).hexdigest())
(out / 'verifier-build-status.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
sys.exit(0 if status == 'passed' else 1)
