import hashlib
import json
import subprocess
import time
from pathlib import Path

workspace = Path(__file__).resolve().parents[4]
output = Path(__file__).resolve().parent
frozen = workspace / 'deliverables/pellmoor-job-pipeline/1.0.0-r8-reliability-20260914'
context = frozen / 'task/pellmoor-job-pipeline/environment'
manifest = json.loads((frozen / 'package-verification.json').read_text(encoding='utf-8'))
for name, expected in manifest['source_sha256'].items():
    if name.startswith('environment/'):
        actual = hashlib.sha256((context.parent / name).read_bytes()).hexdigest()
        assert actual == expected, (name, actual, expected)
tag = 'pellmoor-r8-env:20260915'
command = ['docker', 'build', '--progress=plain', '-t', tag, str(context)]
status = {
    'image_tag': tag,
    'source_zip_sha256': manifest['zip_sha256'],
    'context': str(context),
    'environment_files_match_frozen_manifest': True,
    'command': command,
    'timeout_seconds': 600,
    'status': 'running',
    'exact_image_built': False,
    'browser_launch_passed': False,
}
status_path = output / 'environment-build-status.json'
status_path.write_text(json.dumps(status, indent=2) + '\n', encoding='utf-8')
started = time.monotonic()
try:
    with (output / 'environment-build.log').open('w', encoding='utf-8') as log:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=600, check=False)
    status['exit_code'] = result.returncode
    status['status'] = 'build succeeded' if result.returncode == 0 else 'build failed'
    status['exact_image_built'] = result.returncode == 0
except subprocess.TimeoutExpired:
    status['status'] = 'build timed out after 600 seconds; build client terminated'
    status['exit_code'] = None
finally:
    status['build_duration_seconds'] = round(time.monotonic() - started, 2)
    status_path.write_text(json.dumps(status, indent=2) + '\n', encoding='utf-8')
print(json.dumps(status, indent=2), flush=True)
if status['exact_image_built']:
    inspection = subprocess.run(['docker', 'image', 'inspect', tag, '--format', '{{.Id}}'], capture_output=True, text=True, timeout=30, check=True)
    status['image_id'] = inspection.stdout.strip()
    script = (output / 'browser-launch.cjs').read_text(encoding='utf-8')
    launch = subprocess.run(['docker', 'run', '--rm', '--name', 'pellmoor-r8-env-launch-20260915', '--network', 'none', '--entrypoint', 'node', tag, '-e', script], capture_output=True, text=True, timeout=90, check=False)
    (output / 'browser-launch.log').write_text(launch.stdout + launch.stderr, encoding='utf-8')
    status['browser_launch_exit_code'] = launch.returncode
    status['browser_launch_passed'] = launch.returncode == 0
    if launch.returncode == 0:
        status['browser_runtime'] = json.loads(launch.stdout)
    status_path.write_text(json.dumps(status, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(status, indent=2), flush=True)
