#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/ridgeline-submission"
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

if [[ ! -f /app/server.js ]]; then
  exit 0
fi
# Reject any symlink under /app UNLESS it resolves into the trusted, verifier-image-
# baked global toolchain (NODE_PATH=/usr/local/lib/node_modules, installed by this
# image's own Dockerfile -- not attacker-controlled) OR stays within /app itself.
# environment/Dockerfile installs express/better-sqlite3/react/vite/etc. globally
# there specifically so a build never depends on registry access at grading time;
# client bundlers (Vite/Rollup) don't honor NODE_PATH, so the only way a submission's
# own bundler can resolve a globally-provided package is a node_modules symlink into
# that same trusted path. Submissions take two different shapes here: some symlink
# individual packages -- node_modules/react -> /usr/local/lib/node_modules/react, or
# a scoped package like node_modules/@vitejs/plugin-react -> .../node_modules/@vitejs/
# plugin-react -- landing UNDER the trusted directory; others symlink the whole
# node_modules directory in one shot -- node_modules -> /usr/local/lib/node_modules,
# no trailing segment -- landing exactly AT the trusted directory itself. Both shapes
# are legitimate and must both be allowed, so each trusted root below is matched two
# ways: the bare path (exact match) and the path/* form (anything under it). That is
# an exact-or-slash-prefixed match, never a bare string prefix, so a lookalike like
# /usr/local/lib/node_modules-evil still falls through to the catch-all and zeroes
# the run -- there is no "/" immediately after "node_modules" for either arm to match.
# The /app allowance covers standard npm-created relative symlinks (e.g.
# node_modules/.bin/esbuild -> ../esbuild/bin/esbuild) that resolve to somewhere
# inside the submission's own sandboxed tree -- ordinary npm convention, never a
# sandbox escape. readlink -f is given the symlink's absolute path (from find /app),
# so it canonicalizes each relative target against the symlink's own directory, not
# this script's cwd. Any symlink resolving outside BOTH trusted locations (including
# a dangling one) still zeroes the run, unchanged from before.
while IFS= read -r -d '' link; do
  target="$(readlink -f -- "$link" 2>/dev/null || true)"
  case "$target" in
    /usr/local/lib/node_modules|/usr/local/lib/node_modules/*|/app|/app/*) ;;
    *) exit 0 ;;
  esac
done < <(find /app -type l -print0 2>/dev/null)

# Agents often hardcode /app paths and create mode-600 files; normalize the staged
# tree so the unprivileged verifier process can read UI assets/images and write the DB.
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

# /catalogue is baked unconditionally by this image's Dockerfile (COPY catalogue/
# /catalogue/), so a graded submission that reads the catalogue live at runtime
# (rather than copying it into its own tree at build time) still has it. This
# fallback only matters if that bake was ever skipped: fall back to whatever the
# submission co-located for itself.
mkdir -p /catalogue
if [[ ! -f /catalogue/variants.csv || ! -f /catalogue/postage.csv ]]; then
  for candidate in /app/src/seed/catalogue /app/catalogue /app/src/catalogue; do
    if [[ -f "$candidate/variants.csv" ]]; then
      cp -a "$candidate/." /catalogue/
      break
    fi
  done
fi
chmod -R a+rX /catalogue 2>/dev/null || true

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
  DB_PATH="/app/ridgeline.db" \
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

if ! timeout 3540 rewardkit /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
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
