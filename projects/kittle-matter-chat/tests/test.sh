#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/submission"
APP_PID=""
ZERO_REWARD_JSON='{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"gates_passed":0,"floors_passed":0,"weighted_score":0.0,"graded":0,"no_op":1}'

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

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

write_zero_reward
trap cleanup EXIT

if [[ -z "${REWARDKIT_JUDGE:-}" || -z "${REWARDKIT_MODEL:-}" ]]; then
  printf 'test.sh: set REWARDKIT_JUDGE and REWARDKIT_MODEL in task.toml [verifier.env]\n' >&2
  exit 0
fi

if [[ ! -f /app/server.js ]]; then
  exit 0
fi

while IFS= read -r link; do
  case "$link" in
    /app/node_modules/*)
      target="$(readlink -f "$link" 2>/dev/null || true)"
      case "$target" in
        /app/node_modules/*) ;;
        *) exit 0 ;;
      esac
      ;;
    *) exit 0 ;;
  esac
done < <(find /app -type l 2>/dev/null)

chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true
chmod -R a+rX /assets 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"
chmod -R u+rwX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/app.db"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/app.db"
fi

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="$APP_DB" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "$APP_ENTRY" >"$LOG_DIR/app.log" 2>&1 &
APP_PID="$!"
printf '%s\n' "$APP_PID" > "$LOG_DIR/app.pid"

READY=0
for _ in $(seq 1 120); do
  if probe_ready; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  exit 0
fi

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

python3 - <<'PY'
from pathlib import Path

context = Path("/tests/app_context.md").read_text().strip()
for prompt in Path("/tests").glob("*/*/prompt.md"):
    prompt.write_text(prompt.read_text().replace("{app_context}", context))
PY

run_suite() {
  local suite="$1" budget_sec="$2"
  rm -rf "$LOG_DIR/$suite"
  mkdir -p "$LOG_DIR/$suite"
  timeout "$budget_sec" rewardkit --max-concurrent-agent 1 \
    --output "$LOG_DIR/$suite/reward.json" "/tests/$suite" \
    >"$LOG_DIR/$suite/rewardkit.log" 2>&1
}

rm -rf "$LOG_DIR/scored"
if ! run_suite gates 1500; then
  exit 0
fi
gates_status=0
python3 /tests/tools/score.py "$LOG_DIR" || gates_status=$?
case "$gates_status" in
  0) ;;
  1) exit 0 ;;
  *) write_zero_reward; exit 0 ;;
esac

if ! run_suite scored 11100; then
  exit 0
fi
python3 /tests/tools/score.py "$LOG_DIR" || write_zero_reward
