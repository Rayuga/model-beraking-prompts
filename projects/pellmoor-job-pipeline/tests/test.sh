#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/pellmoor-submission"
PROBE="/tmp/pellmoor-probe.py"
APP_PID=""

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"browser":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"browser":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
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

if [[ ! -s /app/backend/server.js ]]; then
  exit 0
fi
if ! python3 - <<'PY'
from pathlib import Path

root = Path('/app').resolve()
for link in Path('/app').rglob('*'):
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

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
rm -f "$APP_COPY/pellmoor.db" "$APP_COPY/pellmoor.db-shm" "$APP_COPY/pellmoor.db-wal"

if [[ -s "$APP_COPY/package.json" ]] && grep -q '"build"' "$APP_COPY/package.json"; then
  if ! (cd "$APP_COPY" && timeout --signal=TERM --kill-after=20s 600 npm run build) \
      >"$LOG_DIR/build.log" 2>&1; then
    exit 0
  fi
fi
if [[ ! -s "$APP_COPY/public/index.html" ]]; then
  exit 0
fi

chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="$APP_COPY/pellmoor.db" \
  SEED_PATH="/recruitment/records/pellmoor_seed_data.json" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "$APP_COPY/backend/server.js" >"$LOG_DIR/app.log" 2>&1 &
APP_PID="$!"

cat > "$PROBE" <<'PY'
import sys
import urllib.request

for url in ('http://127.0.0.1:3000/api/health', 'http://127.0.0.1:3000/'):
    try:
        urllib.request.urlopen(url, timeout=2).read()
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

if ! timeout --signal=TERM --kill-after=30s 11400 \
  rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

if ! python3 - "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" <<'PY'
import json
import math
import os
import sys
from pathlib import Path

json_path = Path(sys.argv[1])
txt_path = Path(sys.argv[2])
data = json.loads(json_path.read_text(encoding='utf-8'))

for key in ('render', 'constraints', 'functional', 'polish'):
    value = data.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f'missing or non-numeric RewardKit dimension: {key}')
    value = float(value)
    if not math.isfinite(value) or not 0.0 <= value <= 1.0:
        raise ValueError(f'invalid RewardKit dimension {key}={value!r}')
    data[key] = value

if data['render'] < 1.0 or data['constraints'] < 1.0:
    reward = 0.0
else:
    reward = 0.6 * data['functional'] + 0.4 * data['polish']

reward = round(reward, 4)
data.update(reward=reward, browser=reward, graded=1, no_op=0)
json_tmp = json_path.with_suffix('.json.tmp')
txt_tmp = txt_path.with_suffix('.txt.tmp')
json_tmp.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
txt_tmp.write_text(f'{reward:.4f}\n', encoding='utf-8')
os.replace(json_tmp, json_path)
os.replace(txt_tmp, txt_path)
PY
then
  write_zero_reward
  exit 0
fi
