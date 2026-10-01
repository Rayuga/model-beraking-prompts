#!/bin/bash
set -euo pipefail
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

cleanup() {
  APP_PID="$(current_app_pid)"
  if [[ -n "$APP_PID" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  ensure_reward
}

LOG_DIR=/tmp/harness-proposal-controls/original-normal
APP_COPY=/tmp/harness-proposal-controls/original-normal
APP_ENTRY=/tmp/harness-proposal-controls/original-normal/server.js
APP_DB=/tmp/harness-proposal-controls/original-normal/app.db
cat > "$LOG_DIR/app-restart.sh" <<'SH'
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
LOG_DIR="__LOG_DIR__"
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
  HOME="__APP_COPY__" \
  PORT="3000" \
  DB_PATH="__APP_DB__" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "__APP_ENTRY__" >>"$LOG_DIR/app-restart.log" 2>&1 &
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
SH
sed -i \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  -e "s|__APP_ENTRY__|$APP_ENTRY|g" \
  -e "s|__APP_COPY__|$APP_COPY|g" \
  -e "s|__APP_DB__|$APP_DB|g" \
  "$LOG_DIR/app-restart.sh"
chmod 755 "$LOG_DIR/app-restart.sh"
rm -f "$LOG_DIR/app-restart.sh.used"
export APP_RESTART_HELPER="$LOG_DIR/app-restart.sh"
