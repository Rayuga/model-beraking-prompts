#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/common-ground-submission"
PROBE="/tmp/common-ground-probe.py"
APP_PID=""

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  local tmp_txt tmp_json
  tmp_txt="$(mktemp "$LOG_DIR/.reward.txt.XXXXXX")"
  tmp_json="$(mktemp "$LOG_DIR/.reward.json.XXXXXX")"
  printf '0.0\n' > "$tmp_txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"graded":0,"no_op":1}\n' > "$tmp_json"
  mv -f "$tmp_txt" "$LOG_DIR/reward.txt"
  mv -f "$tmp_json" "$LOG_DIR/reward.json"
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

if [[ ! -f /app/server.js ]]; then exit 0; fi
# npm legitimately creates executable links in node_modules/.bin. Permit only
# those links, and only when their resolved target stays inside node_modules.
# Any other submission symlink remains a hard preflight failure.
while IFS= read -r app_link; do
  resolved_link="$(readlink -f -- "$app_link" 2>/dev/null || true)"
  case "$app_link:$resolved_link" in
    /app/node_modules/.bin/*:/app/node_modules/*) ;;
    *) exit 0 ;;
  esac
done < <(find /app -type l -print 2>/dev/null)

mkdir -p /assets/artifacts
if [[ ! -f /assets/artifacts/common_ground_seed.json && -f /tests/assets/artifacts/common_ground_seed.json ]]; then
  cp /tests/assets/artifacts/common_ground_seed.json /assets/artifacts/common_ground_seed.json
fi
if [[ ! -f /app/common_ground_seed.json && -f /assets/artifacts/common_ground_seed.json ]]; then
  cp /assets/artifacts/common_ground_seed.json /app/common_ground_seed.json
fi
if [[ ! -f /app/common_ground_seed.json ]]; then exit 0; fi

# The verifier always starts from the authoritative seed. Runtime databases are
# evidence, not submission source, and must not leak state between rollouts.
rm -f /app/commonground.db /app/commonground.db-shm /app/commonground.db-wal
chmod -R a+rX /app /assets 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/commonground.db"
APP_SEED="/app/common_ground_seed.json"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/commonground.db"
  APP_SEED="$APP_COPY/common_ground_seed.json"
fi

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" PORT="3000" DB_PATH="$APP_DB" SEED_PATH="$APP_SEED" \
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
  if python3 "$PROBE" >/dev/null 2>&1; then READY=1; break; fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then exit 0; fi

if ! timeout 3540 rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
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
data = json.loads(json_path.read_text())
for key in ("render", "constraints", "functional", "polish"):
    value = data.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"missing or non-numeric RewardKit dimension: {key}")
    value = float(value)
    if not math.isfinite(value) or not 0.0 <= value <= 1.0:
        raise ValueError(f"invalid RewardKit dimension {key}={value!r}")
    data[key] = value

reward = 0.0 if data["render"] <= 0.0 or data["constraints"] <= 0.0 else 0.6 * data["functional"] + 0.4 * data["polish"]
reward = round(reward, 4)
data.update({"reward": reward, "browser": reward, "graded": 1, "no_op": 0})
json_tmp = json_path.with_name(".reward.json.tmp")
txt_tmp = txt_path.with_name(".reward.txt.tmp")
json_tmp.write_text(json.dumps(data, indent=2) + "\n")
txt_tmp.write_text(f"{reward:.4f}\n")
os.replace(json_tmp, json_path)
os.replace(txt_tmp, txt_path)
PY
then
  write_zero_reward
  exit 0
fi
