#!/bin/bash
set -euo pipefail
LOG_DIR=/tmp/harness-proposal-controls/proposed-cleanup-term-ignored
ZERO_REWARD_JSON='{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"gates_passed":0,"floors_passed":0,"weighted_score":0.0,"graded":0,"no_op":1}'
APP_PID=""
write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '%s\n' "$ZERO_REWARD_JSON" > "$LOG_DIR/reward.json"
  printf '{"tests":[],"tool":{"name":"rewardkit"},"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '%s\n' "$ZERO_REWARD_JSON" > "$LOG_DIR/reward.json"
}

current_app_pid() {
  if [[ -f "$LOG_DIR/app.pid" ]]; then
    cat "$LOG_DIR/app.pid"
  else
    printf '%s\n' "$APP_PID"
  fi
}

stop_app_group() {
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

cleanup() {
  APP_PID="$(current_app_pid)"
  if [[ -n "$APP_PID" ]]; then
    stop_app_group "$APP_PID" || printf 'test.sh: application cleanup failed\n' >&2
  fi
  ensure_reward
}


write_zero_reward
setsid setpriv --reuid=65534 --regid=65534 --clear-groups node /tmp/harness-proposal-controls/proposed-cleanup-term-ignored/server.js >"$LOG_DIR/app.log" 2>&1 &
APP_PID=$!
printf '%s\n' "$APP_PID" > "$LOG_DIR/app.pid"
for _ in $(seq 1 100); do [[ -f "$LOG_DIR/started" ]] && break; sleep 0.02; done
trap cleanup EXIT
exit 0
