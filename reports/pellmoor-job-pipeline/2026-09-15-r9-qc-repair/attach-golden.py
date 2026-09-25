from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
out = Path(__file__).resolve().parent / 'golden-validation'
name = 'pellmoor-r9-golden'
info = json.loads(subprocess.check_output(['docker', 'inspect', name], text=True))[0]
started = datetime.fromisoformat(info['State']['StartedAt'].replace('Z', '+00:00'))
waiter = subprocess.Popen(['docker', 'wait', name], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
shutil.copyfile(out / 'execution.log', out / 'execution-console-failed.log')
with (out / 'execution.log').open('w', encoding='utf-8') as log:
    stream = subprocess.Popen(['docker', 'logs', '--follow', name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
    for line in stream.stdout:
        log.write(line)
        log.flush()
        print(line, end='', flush=True)
    stream.wait()
result, error = waiter.communicate()
assert waiter.returncode == 0, error
code = int(result.strip())
report = {'exit_code': code, 'elapsed_seconds': round((datetime.now(timezone.utc) - started).total_seconds(), 2), 'started_at': info['State']['StartedAt'], 'container': name, 'scope': 'Frozen r9 golden product/browser regressions, cached image with real lifecycle runner and synthetic RewardKit boundary inputs; not hosted scores', 'console_recovery': 'Original host console could not encode esbuild Unicode progress. Attached to the same still-running container and retained all logs; no product or test restart.'}
(out / 'execution-status.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
raise SystemExit(code)
