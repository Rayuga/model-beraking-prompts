from pathlib import Path
import hashlib
import json
import subprocess
import sys
import time

here = Path(__file__).resolve().parent
root = here.parents[2]
delivery = root / 'deliverables/pellmoor-job-pipeline/1.0.0-r9-qc-repair-20260915'
dimension = sys.argv[1]
assert dimension in ('environment', 'tests')
manifest = json.loads((delivery / 'package-verification.json').read_text())
source = delivery / 'task/pellmoor-job-pipeline' / dimension
for name, digest in manifest['source_sha256'].items():
    if name.startswith(dimension + '/'):
        assert hashlib.sha256((delivery / 'task/pellmoor-job-pipeline' / name).read_bytes()).hexdigest() == digest
out = here / 'image-builds'
out.mkdir(exist_ok=True)
command = ['docker', 'build', '--progress=plain', '-t', f'pellmoor-r9-{dimension}:20260915', str(source)]
start = time.monotonic()
with (out / (dimension + '.log')).open('w', encoding='utf-8') as log:
    try:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=600)
        code, status = result.returncode, 'passed' if result.returncode == 0 else 'failed'
    except subprocess.TimeoutExpired:
        code, status = None, 'local build timeout'
report = {'status': status, 'exit_code': code, 'elapsed_seconds': round(time.monotonic() - start, 2), 'command': command, 'zip_sha256': manifest['zip_sha256'], 'frozen_files_verified': True}
(out / (dimension + '-status.json')).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
raise SystemExit(code if code is not None else 1)
