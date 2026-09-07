#!/bin/bash
# Trusted verifier lifecycle control. Never removes the application database.
set -euo pipefail
python3 - "$@" <<'PY'
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.request

logs = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
pidfile = logs / "app.pid"
action = sys.argv[1] if len(sys.argv) == 2 else ""
if action not in {"start", "stop", "restart"}:
    raise SystemExit("Expected start, stop or restart")

def stop():
    if not pidfile.exists():
        return
    pid = int(pidfile.read_text())
    if pid <= 1:
        raise RuntimeError("Invalid verifier-owned process id")
    try:
        if os.getpgid(pid) != pid:
            raise RuntimeError("Application process is not its own group")
        os.killpg(pid, signal.SIGTERM)
        for _ in range(20):
            time.sleep(.1)
            try:
                os.killpg(pid, 0)
            except ProcessLookupError:
                break
        else:
            os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    pidfile.unlink(missing_ok=True)

if action in {"stop", "restart"}:
    stop()
if action == "stop":
    raise SystemExit(0)
if pidfile.exists():
    raise RuntimeError("App already tracked; use restart")

app_env = {
    "PATH": "/usr/local/bin:/usr/bin:/bin",
    "NODE_PATH": "/usr/local/lib/node_modules",
    "HOME": "/tmp/gridforge-v2-submission",
    "PORT": "3000", "HOST": "0.0.0.0",
    "SEED_PATH": "/assets/workbook_seed.json",
}
with (logs / "app.log").open("ab") as output:
    process = subprocess.Popen(
        ["setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
         "npm", "start"],
        cwd="/app", env=app_env, start_new_session=True,
        stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT)
pidfile.write_text(str(process.pid))
pidfile.chmod(0o600)
for _ in range(120):
    if process.poll() is not None:
        raise SystemExit("Application exited before readiness")
    for route in ("/health", "/"):
        try:
            with urllib.request.urlopen("http://127.0.0.1:3000" + route, timeout=2) as response:
                response.read(1)
            print(json.dumps({"action": action, "ready": True,
                              "database_preserved": True}))
            raise SystemExit(0)
        except (OSError, TimeoutError):
            pass
    time.sleep(.25)
stop()
raise SystemExit("Application readiness timeout")
PY
