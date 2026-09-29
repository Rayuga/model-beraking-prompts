#!/bin/bash
set -euo pipefail
group_has_live_processes() {
  ps -eo pgid=,stat= | awk -v group="$1" '$1 == group && $2 !~ /^[ZX]/ { alive=1 } END { exit !alive }'
}
process_is_alive() {
  ps -p "$1" -o stat= | awk '$1 !~ /^[ZX]/ { alive=1 } END { exit !alive }'
}
probe_ready() {
  python3 - <<'PY' >/dev/null 2>&1
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
LOG_DIR="/evidence/run-golden-20260927-142745"
if [[ ! -f "$LOG_DIR/app.pid" ]]; then
  printf 'app-restart: no app.pid; cannot restart\n' >&2
  exit 1
fi
old_pid="$(cat "$LOG_DIR/app.pid")"
if [[ -n "$old_pid" ]]; then
  kill -- "-$old_pid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    group_has_live_processes "$old_pid" || break
    sleep 0.1
  done
  if group_has_live_processes "$old_pid"; then
    kill -KILL -- "-$old_pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      group_has_live_processes "$old_pid" || break
      sleep 0.1
    done
  fi
  if group_has_live_processes "$old_pid"; then
    printf 'app-restart: original process group did not stop\n' >&2
    exit 1
  fi
fi
if probe_ready; then
  printf 'app-restart: another listener remains after stopping the application\n' >&2
  exit 1
fi
setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="/tmp/cw-structural-workflow/app" \
  PORT="3000" \
  DB_PATH="/tmp/cw-structural-workflow/app/app.db" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  sh -c 'cd "$(dirname "$1")" && exec node "$1"' app-launch "/tmp/cw-structural-workflow/app/server.js" >>"$LOG_DIR/app-restart.log" 2>&1 &
new_pid=$!
printf '%s\n' "$new_pid" > "$LOG_DIR/app.pid"
ready=0
deadline=$((SECONDS + 30))
while (( SECONDS < deadline )); do
  if ! process_is_alive "$new_pid"; then
    printf 'app-restart: replacement process exited before becoming ready\n' >&2
    exit 1
  fi
  if probe_ready; then
    sleep 0.1
    if ! process_is_alive "$new_pid"; then
      printf 'app-restart: replacement process exited during readiness\n' >&2
      exit 1
    fi
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
