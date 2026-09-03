#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/expenseflow-submission"
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

if [[ ! -f /app/server.js || ! -f /app/public/index.html ]]; then
  exit 0
fi
if [[ -n "$(find /app -type l -print -quit 2>/dev/null)" ]]; then
  exit 0
fi

# Agents often hardcode /app paths and create mode-600 files; normalize the staged
# tree so the unprivileged verifier process can read UI assets and write the DB.
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

mkdir -p /assets/artifacts
if [[ ! -f /assets/artifacts/expenseflow_seed.json ]]; then
  for candidate in \
    /app/seed_data.json \
    /app/src/seed_data.json \
    /assets/artifacts/expenseflow_seed.json; do
    if [[ -f "$candidate" ]]; then
      cp "$candidate" /assets/artifacts/expenseflow_seed.json
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

APP_ENTRY="/app/server.js"
if [[ ! -f "$APP_ENTRY" ]]; then
  APP_ENTRY="$APP_COPY/server.js"
fi

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="/app/expenseflow.db" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "$APP_ENTRY" >"$LOG_DIR/app.log" 2>&1 &
APP_PID="$!"

READY=0
for _ in $(seq 1 120); do
  if python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:3000/api/health", timeout=1).read()' >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  exit 0
fi

mkdir -p /root/.codex
cat << 'EOF' > /root/.codex/config.toml
model_provider = "openrouter"
model_reasoning_effort = "max"
approval_policy = "never"
sandbox_mode = "danger-full-access"

[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "responses"
supports_websockets = false

[mcp_servers.playwright]
command = "playwright-mcp"
args = ["--headless", "--isolated", "--executable-path=/usr/local/bin/chromium", "--no-sandbox"]
default_tools_approval_mode = "approve"
EOF

if ! timeout 4200 rewardkit /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

python3 - <<'PY'
import json
import os
import sys
from pathlib import Path

log = Path(os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier"))
path = log / "reward.json"
if not path.is_file():
    raise SystemExit("missing reward.json after rewardkit")

try:
    data = json.loads(path.read_text())
    render = float(data.get("render") or 0)
    constraints = float(data.get("constraints") or 0)
    functional = float(data.get("functional") or 0)
    polish = float(data.get("polish") or 0)

    if render <= 0 or constraints <= 0:
        reward = 0.0
    else:
        reward = round(0.6 * functional + 0.4 * polish, 4)

    data.pop("aesthetic", None)
    data["reward"] = reward
    data["browser"] = reward
    data["graded"] = 1
    data["no_op"] = 0
    path.write_text(json.dumps(data, indent=2) + "\n")
    (log / "reward.txt").write_text(f"{reward}\n")
except Exception as exc:
    # A crash mid-post-process must NOT leave rewardkit's un-gated weighted-mean
    # (aesthetic-inclusive, no render/constraints=0 gate) standing as a false score.
    # Floor to an invalid 0.0 so the run is caught and re-run.
    try:
        path.write_text(json.dumps({"reward": 0.0, "browser": 0.0, "graded": 0, "no_op": 1}, indent=2) + "\n")
        (log / "reward.txt").write_text("0.0\n")
    except Exception:
        pass
    print("reward post-process failed, floored to 0.0/no_op: %s" % exc, file=sys.stderr)
PY
