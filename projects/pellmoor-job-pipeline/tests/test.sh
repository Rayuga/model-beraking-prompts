#!/bin/bash
set -euo pipefail
umask 077

# Starts the submitted server safely and guarantees a numeric reward on disk
# whatever happens. The app runs as nobody, with a cleared environment, from a
# copy, so a submission cannot reach /tests or the rest of the filesystem.
APP_ROOT="/workspace/pellmoor-job-pipeline"
LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/pellmoor-job-pipeline-submission"
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

# The contract fixes where the server lives. A submission that put the app
# somewhere else is not gradeable and scores the floor. The browser side is NOT
# checked here, because for a task with a build step it does not exist until the
# build has run.
if [[ ! -f "/workspace/pellmoor-job-pipeline/backend/server.js" ]]; then
  exit 0
fi
if [[ -n "$(find "$APP_ROOT" -type l -print -quit 2>/dev/null)" ]]; then
  exit 0
fi

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a "$APP_ROOT/." "$APP_COPY/"

# Grade a clean database. cp -a brought whatever the agent left behind, and
# seed-dependent criteria are not deterministic against somebody else's leftover
# rows.
rm -f "$APP_COPY/pellmoor.db" "$APP_COPY/pellmoor.db-wal" "$APP_COPY/pellmoor.db-shm"

# Build before boot, as root, before privileges drop. A submission whose source
# is correct but whose bundle was never generated would otherwise score zero for
# a reason that is nothing to do with the task. An absent or failing build is not
# fatal on its own — a submission that shipped a prebuilt bundle still boots.
if [[ -f "$APP_COPY/package.json" ]] && grep -q '"build"' "$APP_COPY/package.json"; then
  (cd "$APP_COPY" && timeout 1500 npm run build) >"$LOG_DIR/build.log" 2>&1 || true
fi

# NOW the browser side has to exist. After the build, a submission with nothing
# to serve is not gradeable.
if [[ ! -f "$APP_COPY/public/index.html" ]]; then
  exit 0
fi

chown -R 65534:65534 "$APP_COPY"

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="$APP_COPY/pellmoor.db" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "$APP_COPY/backend/server.js" >"$LOG_DIR/app.log" 2>&1 &
APP_PID="$!"

READY=0
for _ in $(seq 1 160); do
  if python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:3000/api/health", timeout=1).read()' >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  exit 0
fi

if ! timeout 7140 rewardkit /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

# RewardKit supplies the four browser dimension scores. Render and constraints
# are gates: either one scoring zero makes the reward zero. Only functional and
# polish contribute when both gates pass. A gate that earned partial credit is
# not a failure, so it must not erase functional and polish work.
if ! python3 - "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" <<'PY'
import json
import sys

json_path, txt_path = sys.argv[1], sys.argv[2]
with open(json_path, encoding="utf-8") as fh:
    data = json.load(fh)

for key in ("render", "constraints", "functional", "polish"):
    try:
        data[key] = float(data.get(key) or 0.0)
    except (TypeError, ValueError):
        data[key] = 0.0

if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.4 * data["polish"]

reward = round(reward, 4)
data["reward"] = reward
data["browser"] = reward
with open(json_path, "w", encoding="utf-8") as fh:
    json.dump(data, fh)
with open(txt_path, "w", encoding="utf-8") as fh:
    fh.write(f"{reward:.4f}\n")
PY
then
  write_zero_reward
  exit 0
fi
