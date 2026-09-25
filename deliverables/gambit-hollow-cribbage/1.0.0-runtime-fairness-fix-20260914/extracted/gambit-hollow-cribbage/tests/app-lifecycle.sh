#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
[[ "${1:-}" == "restart" ]] || { echo 'Usage: bash /tests/app-lifecycle.sh restart' >&2; exit 2; }
APP_PID="$(cat "$LOG_DIR/app.pid")"
APP_ENTRY="$(cat "$LOG_DIR/app-entry")"
APP_DB="$(cat "$LOG_DIR/app-db")"
[[ "$APP_PID" =~ ^[0-9]+$ && "$APP_PID" -gt 1 ]] || exit 1
case "$APP_ENTRY:$APP_DB" in
  /app/serve.js:/app/gambit.db|/tmp/gambit-submission/serve.js:/tmp/gambit-submission/gambit.db) ;;
  *) echo 'Invalid managed application paths' >&2; exit 1 ;;
esac
if kill -0 "$APP_PID" 2>/dev/null; then
  tr '\0' '\n' < "/proc/$APP_PID/cmdline" | grep -Fx -- "$APP_ENTRY" >/dev/null || { echo 'Managed PID no longer identifies the app' >&2; exit 1; }
  kill -- -"$APP_PID" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 -- -"$APP_PID" 2>/dev/null || break
    sleep .1
  done
  kill -KILL -- -"$APP_PID" 2>/dev/null || true
fi
setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="/tmp/gambit-submission" \
  PORT="3000" DB_PATH="$APP_DB" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  sh -c 'cd -- "$(dirname -- "$1")" && exec node "$1"' sh "$APP_ENTRY" >>"$LOG_DIR/app.log" 2>&1 &
printf '%s\n' "$!" > "$LOG_DIR/app.pid"
python3 - <<'PY'
import time
import urllib.request
deadline = time.monotonic() + 45
while time.monotonic() < deadline:
    for path in ('/api/health', '/'):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000' + path, timeout=1) as response:
                response.read(1024)
            print('Application ready after restart')
            raise SystemExit(0)
        except OSError:
            pass
    time.sleep(.25)
raise SystemExit('Application failed to become ready after restart')
PY
