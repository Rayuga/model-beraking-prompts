#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/bazaarbridge-submission"
APP_PID=""
SIMULATION_CLOCK="2026-09-09T12:00:00Z"

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
  printf '{"tests":[],"tool":{"name":"rewardkit"},"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
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

mkdir -p /assets/artifacts
if [[ ! -f /assets/artifacts/bazaarbridge_seed_data.json ]]; then
  for candidate in /app/seed_data.json /app/src/seed_data.json; do
    if [[ -f "$candidate" ]]; then
      cp "$candidate" /assets/artifacts/bazaarbridge_seed_data.json
      break
    fi
  done
fi
chmod -R a+rX /assets 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"
chmod -R u+rwX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/bazaarbridge.db"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/bazaarbridge.db"
fi

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="$APP_DB" \
  SIMULATION_CLOCK="$SIMULATION_CLOCK" \
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

cat > "$LOG_DIR/bazaarbridge-restart.sh" <<'SH'
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
LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
if [[ ! -f "$LOG_DIR/app.pid" ]]; then
  printf 'bazaarbridge-restart: no app.pid; cannot restart\n' >&2
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
  SIMULATION_CLOCK="__SIM_CLOCK__" \
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
printf 'bazaarbridge-restart pid=%s ready=%s at %s\n' "$new_pid" "$ready" "$(date -u +%FT%TZ)" >> "$LOG_DIR/app-restart.log"
if [[ "$ready" != "1" ]]; then
  printf 'bazaarbridge-restart: application did not answer HTTP within 30 seconds\n' >&2
  exit 1
fi
exit 0
SH
sed -i \
  -e "s|__APP_ENTRY__|$APP_ENTRY|g" \
  -e "s|__APP_COPY__|$APP_COPY|g" \
  -e "s|__APP_DB__|$APP_DB|g" \
  -e "s|__SIM_CLOCK__|$SIMULATION_CLOCK|g" \
  "$LOG_DIR/bazaarbridge-restart.sh"
chmod 755 "$LOG_DIR/bazaarbridge-restart.sh"
export BAZAARBRIDGE_RESTART_HELPER="$LOG_DIR/bazaarbridge-restart.sh"

if ! timeout 12600 rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  ensure_reward
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
