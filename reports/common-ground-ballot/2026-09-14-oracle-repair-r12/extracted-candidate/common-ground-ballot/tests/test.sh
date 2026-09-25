#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/common-ground-submission"

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  local tmp_txt tmp_json
  tmp_txt="$(mktemp "$LOG_DIR/.reward.txt.XXXXXX")"
  tmp_json="$(mktemp "$LOG_DIR/.reward.json.XXXXXX")"
  printf '0.0\n' > "$tmp_txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$tmp_json"
  mv -f "$tmp_txt" "$LOG_DIR/reward.txt"
  mv -f "$tmp_json" "$LOG_DIR/reward.json"
  printf '{"tool":{"name":"rewardkit"},"tests":[],"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

cleanup() {
  python3 /tests/app-lifecycle.py stop 2>/dev/null || true
  ensure_reward
}

write_zero_reward
trap cleanup EXIT
python3 /tests/prompt-provenance.py "$LOG_DIR/prompt-provenance.json"

if [[ ! -f /app/server.js ]]; then exit 0; fi
while IFS= read -r app_link; do
  resolved_link="$(readlink -f -- "$app_link" 2>/dev/null || true)"
  case "$resolved_link" in
    /app/*|/usr/local/lib/node_modules/*) ;;
    *) exit 0 ;;
  esac
done < <(find /app -type l -print 2>/dev/null)

mkdir -p /assets/artifacts
if [[ -f /tests/assets/artifacts/common_ground_seed.json ]]; then
  cp /tests/assets/artifacts/common_ground_seed.json /assets/artifacts/common_ground_seed.json
fi
if [[ -f /assets/artifacts/common_ground_seed.json ]]; then
  cp /assets/artifacts/common_ground_seed.json /app/common_ground_seed.json
fi
if [[ ! -f /app/common_ground_seed.json ]]; then exit 0; fi

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

python3 /tests/app-lifecycle.py start --entry "$APP_ENTRY" \
  --database "$APP_DB" --seed "$APP_SEED" --log "$LOG_DIR/app.log"

READY=0
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" != "1" ]]; then exit 0; fi

if ! timeout 12600 rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

if ! python3 - "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" "$LOG_DIR/ctrf.json" <<'PY'
import json
import math
import sys
from pathlib import Path

json_path = Path(sys.argv[1])
txt_path = Path(sys.argv[2])
ctrf_path = Path(sys.argv[3])
data = json.loads(json_path.read_text())

for key in ("render", "constraints", "functional", "polish", "visual"):
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
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]

reward = round(reward, 4)
data["reward"] = reward
data["graded"] = 1
data["no_op"] = 0
json_path.write_text(json.dumps(data, indent=2) + "\n")
txt_path.write_text(f"{reward:.4f}\n")
ctrf_path.write_text(json.dumps({
  "tool": {"name": "rewardkit"},
  "tests": [{"name": "render", "status": "passed" if data["render"] > 0 else "failed"},
            {"name": "constraints", "status": "passed" if data["constraints"] > 0 else "failed"},
            {"name": "functional", "status": "passed" if data["functional"] > 0.05 else "failed"},
            {"name": "polish", "status": "passed" if data["polish"] > 0 else "failed"},
            {"name": "visual", "status": "passed" if data["visual"] > 0 else "failed"}],
  "summary": {"passed": (data["render"] > 0) + (data["constraints"] > 0) + (data["functional"] > 0.05) + (data["polish"] > 0) + (data["visual"] > 0), "failed": (data["render"] <= 0) + (data["constraints"] <= 0) + (data["functional"] <= 0.05) + (data["polish"] <= 0) + (data["visual"] <= 0), "skipped": 0, "total": 5}
}, indent=2) + "\n")
PY
then
  write_zero_reward
  exit 0
fi
