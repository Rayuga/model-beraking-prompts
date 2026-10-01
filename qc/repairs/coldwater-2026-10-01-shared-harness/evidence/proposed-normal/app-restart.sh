#!/bin/bash
set -euo pipefail
stop_app_group () 
{ 
    timeout 8 python3 - "$1" <<'PY'
import os
from pathlib import Path
import signal
import sys
import time

pid = int(sys.argv[1])
if pid <= 1:
    sys.exit("invalid application process group")

def running():
    for entry in Path("/proc").glob("[0-9]*/stat"):
        try:
            fields = entry.read_text().rsplit(")", 1)[1].split()
            if int(fields[2]) == pid and fields[0] not in ("Z", "X"):
                return True
        except (FileNotFoundError, ProcessLookupError):
            continue
    return False

for sig, grace in ((signal.SIGTERM, 5), (signal.SIGKILL, 1)):
    if not running():
        sys.exit(0)
    try:
        os.killpg(pid, sig)
    except ProcessLookupError:
        sys.exit(0)
    deadline = time.monotonic() + grace
    while time.monotonic() < deadline:
        if not running():
            sys.exit(0)
        time.sleep(0.1)
sys.exit("application process group did not terminate")
PY

}
probe_ready () 
{ 
    timeout --signal=TERM --kill-after=1s 3s python3 - <<'PY' > /dev/null 2>&1
import sys
import urllib.error
import urllib.request

for url in ("http://127.0.0.1:3000/api/health", "http://127.0.0.1:3000/"):
    try:
        urllib.request.urlopen(url, timeout=2).read(1)
    except urllib.error.HTTPError:
        sys.exit(0)
    except Exception:
        continue
    sys.exit(0)
sys.exit(1)
PY

}
replacement_listens () 
{ 
    setpriv --reuid=65534 --regid=65534 --clear-groups python3 - "$1" <<'PY' > /dev/null 2>&1
import os
from pathlib import Path
import sys

process = Path("/proc") / sys.argv[1]
try:
    if process.joinpath("stat").read_text().rsplit(")", 1)[1].split()[0] in ("Z", "X"):
        sys.exit(1)
    sockets = {os.readlink(fd) for fd in process.joinpath("fd").iterdir()}
    for table in ("/proc/net/tcp", "/proc/net/tcp6"):
        for line in Path(table).read_text().splitlines()[1:]:
            fields = line.split()
            if (fields[1].split(":")[1] == "0BB8" and fields[3] == "0A"
                    and "socket:[" + fields[9] + "]" in sockets):
                sys.exit(0)
except (FileNotFoundError, ProcessLookupError):
    pass
sys.exit(1)
PY

}
wait_for_app_ready () 
{ 
    local pid="$1";
    export -f probe_ready replacement_listens;
    timeout --signal=TERM --kill-after=1s 30s bash -c '
    pid="$1"
    for ((attempt=0; attempt<120; attempt++)); do
      kill -0 "$pid" 2>/dev/null || exit 1
      if replacement_listens "$pid" && probe_ready && kill -0 "$pid" 2>/dev/null; then
        exit 0
      fi
      sleep 0.25
    done
    exit 1
  ' bash "$pid"
}
LOG_DIR="/tmp/harness-proposal-controls/proposed-normal"
if [[ ! -f "$LOG_DIR/app.pid" ]]; then
  printf 'app-restart: no app.pid; cannot restart\n' >&2
  exit 1
fi
old_pid="$(cat "$LOG_DIR/app.pid")"
if [[ -n "$old_pid" ]]; then
  if ! stop_app_group "$old_pid"; then
    printf 'app-restart: old application did not terminate\n' >&2
    exit 1
  fi
fi
setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="/tmp/harness-proposal-controls/proposed-normal" \
  PORT="3000" \
  DB_PATH="/tmp/harness-proposal-controls/proposed-normal/app.db" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "/tmp/harness-proposal-controls/proposed-normal/server.js" >>"$LOG_DIR/app-restart.log" 2>&1 &
new_pid=$!
printf '%s\n' "$new_pid" > "$LOG_DIR/app.pid"
ready=0
if wait_for_app_ready "$new_pid"; then
  ready=1
fi
printf 'app-restart pid=%s ready=%s at %s\n' "$new_pid" "$ready" "$(date -u +%FT%TZ)" >> "$LOG_DIR/app-restart.log"
if [[ "$ready" != "1" ]]; then
  printf 'app-restart: application did not answer HTTP within 30 seconds\n' >&2
  exit 1
fi
exit 0
