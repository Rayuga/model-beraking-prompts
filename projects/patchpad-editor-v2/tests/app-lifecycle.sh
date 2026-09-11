#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
PID_FILE="$LOG_DIR/app.pid"
APP_HOME="/tmp/patchpad-editor-v2-submission"
mkdir -p "$LOG_DIR"

stop_app() {
  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE")"
    [[ "$pid" =~ ^[0-9]+$ && "$pid" -gt 1 ]] || return 1
    kill -- -"$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 -- -"$pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- -"$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
}

start_app() {
  [[ ! -e "$PID_FILE" ]] || { echo 'App already managed; use restart' >&2; return 1; }
  mkdir -p "$APP_HOME"
  chown 65534:65534 "$APP_HOME"
  setsid env -i \
    PATH="/usr/local/bin:/usr/bin:/bin" \
    NODE_PATH="/usr/local/lib/node_modules" \
    HOME="$APP_HOME" PORT="3000" HOST="0.0.0.0" \
    SEED_PATH="/assets/incident_seed.json" \
    setpriv --reuid=65534 --regid=65534 --clear-groups \
    sh -c 'cd /app && exec npm start' >>"$LOG_DIR/app.log" 2>&1 &
  echo "$!" > "$PID_FILE"
  if ! python3 - <<'PY'
import time
import urllib.request
deadline = time.monotonic() + 45
while time.monotonic() < deadline:
    for path in ('/health', '/'):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000' + path, timeout=1) as response:
                response.read(1024)
            raise SystemExit(0)
        except OSError:
            pass
    time.sleep(.25)
raise SystemExit('Application did not become ready after start/restart')
PY
  then
    stop_app
    return 1
  fi
  echo "Application ready; managed process group $(cat "$PID_FILE")"
}

case "${1:-}" in
  start) start_app ;;
  restart) stop_app; start_app ;;
  stop) stop_app ;;
  *) echo 'Usage: bash /tests/app-lifecycle.sh start|restart|stop' >&2; exit 2 ;;
esac
