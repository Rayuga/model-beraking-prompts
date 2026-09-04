#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/coursemark-submission"
PROBE="/tmp/coursemark-probe.py"
APP_PID=""

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

cleanup() {
  if [[ -n "$APP_PID" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- -"$APP_PID" 2>/dev/null || true
  fi
  ensure_reward
}

write_zero_reward
trap cleanup EXIT

if [[ ! -s /app/server.js || ! -s /app/public/index.html ]]; then
  exit 0
fi
if ! python3 - <<'PY'
from pathlib import Path

root = Path("/app").resolve()
for link in Path("/app").rglob("*"):
    if not link.is_symlink():
        continue
    try:
        target = link.resolve(strict=True)
    except (OSError, RuntimeError):
        raise SystemExit(1)
    if target != root and root not in target.parents:
        raise SystemExit(1)
PY
then
  exit 0
fi

rm -f /app/coursemark.db /app/coursemark.db-shm /app/coursemark.db-wal
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
rm -f "$APP_COPY/coursemark.db" "$APP_COPY/coursemark.db-shm" "$APP_COPY/coursemark.db-wal"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/coursemark.db"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/coursemark.db"
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

cat > "$PROBE" <<'PY'
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

READY=0
for _ in $(seq 1 120); do
  if python3 "$PROBE" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  exit 0
fi

if ! timeout --signal=TERM --kill-after=30s 6300 \
  rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

if ! python3 - "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" <<'PY'
import json
import math
import sys
from pathlib import Path

json_path = Path(sys.argv[1])
txt_path = Path(sys.argv[2])
data = json.loads(json_path.read_text())

for key in ("render", "constraints", "functional", "polish"):
    value = data.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"missing or non-numeric RewardKit dimension: {key}")
    value = float(value)
    if not math.isfinite(value) or not 0.0 <= value <= 1.0:
        raise ValueError(f"invalid RewardKit dimension {key}={value!r}")
    data[key] = value

if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.4 * data["polish"]

reward = round(reward, 4)
data["reward"] = reward
data["graded"] = 1
data["no_op"] = 0
json_path.write_text(json.dumps(data, indent=2) + "\n")
txt_path.write_text(f"{reward:.4f}\n")
PY
then
  write_zero_reward
  exit 0
fi
