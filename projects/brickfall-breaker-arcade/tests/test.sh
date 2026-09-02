#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/brickfall-submission"
PROBE="/tmp/brickfall-probe.py"
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
    wait "$APP_PID" 2>/dev/null || true
  fi
  ensure_reward
}

write_zero_reward
trap cleanup EXIT

if [[ ! -s /app/server.js || ! -s /app/public/index.html ]]; then
  exit 0
fi
if [[ -n "$(find /app -type l -print -quit 2>/dev/null)" ]]; then
  exit 0
fi

# Normalize the submitted tree before booting it as an unprivileged user.
rm -f /app/brickfall.db /app/brickfall.db-shm /app/brickfall.db-wal
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
rm -f "$APP_COPY/brickfall.db" "$APP_COPY/brickfall.db-shm" "$APP_COPY/brickfall.db-wal"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"

# Prefer /app because submissions often hardcode it; use the staged copy when
# /app is not writable to the unprivileged process.
APP_ENTRY="/app/server.js"
APP_DB="/app/brickfall.db"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/brickfall.db"
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

# Any HTTP response is enough to hand control to the browser judges; a booted
# but visibly broken application must be graded instead of treated as a no-op.
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

if ! timeout 3540 rewardkit /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

# Render and constraints are gates. Only functional and polish contribute once
# both gates have non-zero scores. Invalid or missing dimensions restore zero.
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
