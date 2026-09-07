#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/patchpad-v2-submission"
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

if [[ ! -s /app/package.json || ! -s /app/APP_MANIFEST.md ]]; then
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
    trusted_roots = [root, Path("/usr/local/lib/node_modules"), Path("/opt/patchpad-deps")]
    if not any(target == base or base in target.parents for base in trusted_roots):
        raise SystemExit(1)
PY
then
  exit 0
fi

# The manifest locates the submission's database; its claims are not score evidence.
if ! python3 - <<'PY'
import json
import re
from pathlib import Path
root = Path("/app").resolve()
package = json.loads((root / "package.json").read_text())
assert isinstance(package.get("scripts", {}).get("start"), str), "npm start is required"
manifest = (root / "APP_MANIFEST.md").read_text()
paths = set(re.findall(r"/app/[A-Za-z0-9_./-]+\.(?:sqlite3|sqlite|db)\b", manifest))
assert len(paths) == 1, "Document one absolute SQLite file path under /app"
db = Path(paths.pop()).resolve()
assert root in db.parents, "Database must remain inside /app"
for suffix in ("", "-wal", "-shm", "-journal"):
    candidate = Path(str(db) + suffix)
    if candidate.is_file():
        candidate.unlink()
PY
then
  exit 0
fi
chmod -R a+rX /app 2>/dev/null || true
chown -R 65534:65534 /app
APP_RUN="/app"
mkdir -p "$APP_COPY"
chown 65534:65534 "$APP_COPY"

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  HOST="0.0.0.0" \
  SEED_PATH="/assets/incident_seed.json" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  sh -c 'cd "$1" && exec npm start' sh "$APP_RUN" >"$LOG_DIR/app.log" 2>&1 &
APP_PID="$!"

READY=0
for _ in $(seq 1 120); do
  if python3 - <<'PY' >/dev/null 2>&1
import urllib.request
for url in ("http://127.0.0.1:3000/health", "http://127.0.0.1:3000/"):
    try:
        urllib.request.urlopen(url, timeout=2).read()
        raise SystemExit(0)
    except Exception:
        pass
raise SystemExit(1)
PY
  then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  exit 0
fi

if ! timeout --signal=TERM --kill-after=30s 12000 \
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

reward = 0.0 if data["render"] < 1.0 or data["constraints"] < 1.0 else 0.6 * data["functional"] + 0.4 * data["polish"]
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
