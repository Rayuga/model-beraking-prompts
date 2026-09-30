#!/bin/bash
set -euo pipefail
probe_ready() {
  python3 - <<'PY' >/dev/null 2>&1
import sys
import urllib.error
import urllib.request

for url in ("http://127.0.0.1:3000/api/health", "http://127.0.0.1:3000/"):
    try:
        urllib.request.urlopen(url, timeout=2).read()
    except urllib.error.HTTPError:
        sys.exit(0)
    except Exception:
        continue
    sys.exit(0)
sys.exit(1)
PY
}
LOG_DIR="/evidence/run-golden-20260930-091538"
if [[ ! -f "$LOG_DIR/app.pid" ]]; then
  printf 'app-restart: no app.pid; cannot restart\n' >&2
  exit 1
fi
old_pid="$(cat "$LOG_DIR/app.pid")"
if [[ -n "$old_pid" ]]; then
  kill -- "-$old_pid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    kill -0 -- "-$old_pid" 2>/dev/null || break
    sleep 0.1
  done
fi
setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="/tmp/cw-structural-workflow/app" \
  PORT="3000" \
  DB_PATH="/tmp/cw-structural-workflow/app/app.db" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "/tmp/cw-structural-workflow/app/server.js" >>"$LOG_DIR/app-restart.log" 2>&1 &
new_pid=$!
printf '%s\n' "$new_pid" > "$LOG_DIR/app.pid"
ready=0
for _ in $(seq 1 120); do
  if probe_ready; then
    ready=1
    break
  fi
  sleep 0.25
done
printf 'app-restart pid=%s ready=%s at %s\n' "$new_pid" "$ready" "$(date -u +%FT%TZ)" >> "$LOG_DIR/app-restart.log"
if [[ "$ready" != "1" ]]; then
  printf 'app-restart: application did not answer HTTP within 30 seconds\n' >&2
  exit 1
fi
exit 0
