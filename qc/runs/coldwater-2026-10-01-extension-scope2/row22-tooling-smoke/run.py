import hashlib
import json
from pathlib import Path
import subprocess
import time

root = Path.cwd()
out = Path(__file__).resolve().parent
task = root / '.qc-cache/coldwater-2026-10-01-extension-scope2/task'
image = 'sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d'
argv = ['docker', 'run', '--pull', 'never', '--rm', '--network', 'none', '--shm-size', '1g',
        '--mount', f'type=bind,source={task},target=/task,readonly',
        '--mount', f'type=bind,source={out},target=/evidence',
        '-e', 'LITELLM_LOCAL_MODEL_COST_MAP=True', image, 'python3', '/evidence/probe.py']
binding = {'input_sha256': 'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8',
           'image_id': image, 'argv': argv, 'provider_invoked': False,
           'configured_judge_invoked': False,
           'task_dockerfile_sha256': hashlib.sha256((task/'tests/Dockerfile').read_bytes()).hexdigest()}
(out/'command.json').write_text(json.dumps(binding, indent=2)+'\n', encoding='utf-8')
started = time.monotonic()
proc = subprocess.run(argv, capture_output=True, timeout=120)
(out/'stdout.log').write_bytes(proc.stdout)
(out/'stderr.log').write_bytes(proc.stderr)
(out/'RESULTS.json').write_text(json.dumps({**binding, 'returncode':proc.returncode,
    'wall_seconds':time.monotonic()-started}, indent=2)+'\n', encoding='utf-8')
hashes = {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
          for p in out.iterdir() if p.is_file() and p.name != 'artifact-hashes.json'}
(out/'artifact-hashes.json').write_text(json.dumps(hashes, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'returncode':proc.returncode, 'wall_seconds':time.monotonic()-started,
                  'output':str(out)}))
raise SystemExit(proc.returncode)
