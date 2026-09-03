#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_PID=""
mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '{"reward":0.0,"browser":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"browser":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

cleanup() {
  if [[ -n "$APP_PID" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  ensure_reward
}

write_zero_reward
trap cleanup EXIT

if [[ ! -f /app/server.js || ! -f /app/public/index.html ]]; then exit 0; fi
if [[ -n "$(find /app -type l -print -quit 2>/dev/null)" ]]; then exit 0; fi

chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true
chmod -R a+rX /assets 2>/dev/null || true

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="/tmp" PORT="3000" DB_PATH="/app/coursemark.db" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node /app/server.js >"$LOG_DIR/app.log" 2>&1 &
APP_PID="$!"

READY=0
for _ in $(seq 1 120); do
  if python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:3000/api/health", timeout=1).read()' >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then exit 0; fi

if ! timeout 3540 rewardkit /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

python3 - <<'PY'
import json
import os
from pathlib import Path

log = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
path = log / "reward.json"
if not path.is_file():
    raise SystemExit("missing reward.json")
data = json.loads(path.read_text())
render = float(data.get("render") or 0)
constraints = float(data.get("constraints") or 0)
functional = float(data.get("functional") or 0)
polish = float(data.get("polish") or 0)
reward = 0.0 if render <= 0 or constraints <= 0 else round(0.6 * functional + 0.4 * polish, 4)
data["reward"] = reward
data["browser"] = reward
data["graded"] = 1
data["no_op"] = 0
path.write_text(json.dumps(data, indent=2) + "\n")
(log / "reward.txt").write_text(f"{reward}\n")
PY
