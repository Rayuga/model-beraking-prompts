#!/bin/bash
# Start the submitted app with `bash start.sh` from a copy of /app, wait for both halves to
# answer, then hand the four browser-judge dimensions to rewardkit. Any failure
# on the way there is a zero reward, not a Config_Error.
set -uo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
API="http://127.0.0.1:4000"
UI="http://127.0.0.1:5173"
APP_COPY="/tmp/boardloom-submission"
APP_PGID=""

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
  if [[ -n "$APP_PGID" ]]; then
    kill -- -"$APP_PGID" 2>/dev/null || true
  fi
  ensure_reward
}
write_zero_reward
trap cleanup EXIT

# The contract is `bash start.sh` from /app. Without it there is nothing to grade.
if [[ ! -f /app/start.sh ]]; then
  echo "[test.sh] no /app/start.sh — nothing to start" >&2
  exit 0
fi
chmod +x /app/start.sh 2>/dev/null || true

# Clear any database left behind so the seed loads from scratch.
find /app -name node_modules -prune -o -type f \
     \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \
        -o -name '*-wal' -o -name '*-shm' -o -name '*-journal' \) -print -delete 2>/dev/null || true

# The brief says the project lives in /app, and submissions hardcode that far more
# often than they honour an injected path, so the app is booted in place when /app
# is writable by the unprivileged user. A copy is kept as the fallback for a
# read-only /app, and the app is always started from its own directory so a
# start.sh written with relative paths resolves them.
rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/" 2>/dev/null || true
chmod +x /app/start.sh "$APP_COPY/start.sh" 2>/dev/null || true
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true

# The verifier image carries every package the app needs. There is no registry
# here, so a submission that vendored nothing still starts. The submission chose
# its own layout, so every package.json it wrote gets the set that matches what
# that package asks for, wherever it sits.
stage_deps() {
  local pkg="$1"
  local dir
  dir="$(dirname "$pkg")"
  [[ -d "$dir/node_modules" ]] && return 0
  local wants_client=0
  local wants_server=0
  grep -qE '"(vite|react|react-dom|@vitejs/plugin-react|tailwindcss|typescript)"' "$pkg" 2>/dev/null && wants_client=1
  grep -qE '"(express|better-sqlite3|nodemailer|cors|tsx)"' "$pkg" 2>/dev/null && wants_server=1
  [[ "$wants_client" -eq 0 && "$wants_server" -eq 0 ]] && wants_server=1
  mkdir -p "$dir/node_modules" 2>/dev/null || return 0
  if [[ "$wants_client" -eq 1 && -d /opt/boardloom/frontend/node_modules ]]; then
    cp -a /opt/boardloom/frontend/node_modules/. "$dir/node_modules/" 2>/dev/null || true
  fi
  if [[ "$wants_server" -eq 1 && -d /opt/boardloom/backend/node_modules ]]; then
    cp -a /opt/boardloom/backend/node_modules/. "$dir/node_modules/" 2>/dev/null || true
  fi
  return 0
}

for tree in /app "$APP_COPY"; do
  while IFS= read -r pkg_json; do
    [[ -n "$pkg_json" ]] && stage_deps "$pkg_json"
  done < <(find "$tree" -name node_modules -prune -o -name package.json -type f -print 2>/dev/null)
  if [[ ! -d "$tree/node_modules" && -d /opt/boardloom/backend/node_modules ]]; then
    cp -a /opt/boardloom/backend/node_modules "$tree/node_modules" 2>/dev/null || true
  fi
done

chown -R 65534:65534 "$APP_COPY" 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

APP_DIR="/app"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_DIR="$APP_COPY"
fi

setsid setpriv --reuid=65534 --regid=65534 --clear-groups env -i \
  PATH=/usr/local/bin:/usr/bin:/bin \
  HOME=/tmp \
  PORT=4000 \
  HOST=0.0.0.0 \
  CI=1 \
  SQLITE_PATH="$APP_DIR/boardloom.db" \
  bash -c 'cd "$1" && exec bash ./start.sh' _ "$APP_DIR" >>"$LOG_DIR/app.log" 2>&1 &
APP_PGID="$!"
echo "[test.sh] app booted from $APP_DIR" >&2

# The API has to answer /health - without it there is nothing to grade.
# Anything that answers HTTP is handed to the browser judges, error responses
# included: a submission that boots but serves a broken page must be graded on
# visible evidence rather than collapsing into an ungraded no-op zero.
probe_http() {
  python3 - <<'PY'
import sys, urllib.error, urllib.request
for url in ("http://127.0.0.1:4000/health", "http://127.0.0.1:5173/", "http://127.0.0.1:4000/"):
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

API_READY=0
for _ in $(seq 1 480); do
  if probe_http >/dev/null 2>&1; then
    API_READY=1
    break
  fi
  sleep 1
done
if [[ "$API_READY" != "1" ]]; then
  echo "[test.sh] nothing answered HTTP on 4000 or 5173; grading anyway on visible evidence" >&2
  tail -40 "$LOG_DIR/app.log" >&2 || true
fi

# Then give the UI its own window on 5173.
UI_READY=0
for _ in $(seq 1 120); do
  if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5173', timeout=2).read(1)" >/dev/null 2>&1; then
    UI_READY=1
    break
  fi
  sleep 1
done

# start.sh runs Vite on 5173 itself. If nothing answers there the browser
# dimensions fail on their own evidence rather than being bridged around.
if [[ "$UI_READY" != "1" ]]; then
  echo "[test.sh] nothing serving on 5173; the browser judges will score what is there" >&2
fi

if [[ "$UI_READY" == "1" ]]; then
  echo "[test.sh] app is up on $API and $UI"
else
  echo "[test.sh] no UI reachable on 5173 - grading anyway; the browser dimensions will fail on their own evidence" >&2
fi


# The wrapper budget exists so an overrun still reports criteria RewardKit
# already graded: when it wrote reward files before the wrapper fired, keep them.
if ! timeout 9900 rewardkit /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  echo "[test.sh] rewardkit did not finish; keeping whatever it already graded" >&2
  ensure_reward
  exit 0
fi

# rewardkit writes reward.json but not reward.txt, and write_zero_reward seeded
# reward.txt with 0.0 up front so a crash fails closed. Apply the task's reward
# rule now that the judges have finished, and publish the result.
#
#   render and constraints are hard gates and carry no reward mass of their own.
#   If either is not a clean pass, the reward is 0 however good the rest is.
#   Otherwise:  reward = 0.6 * functional + 0.4 * polish
python3 - "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" <<'SCORE'
import json, sys

path, out = sys.argv[1], sys.argv[2]
d = json.load(open(path))

def dim(name):
    v = d.get(name)
    if not isinstance(v, (int, float)):
        raise SystemExit(f"[test.sh] reward.json has no numeric '{name}'")
    return float(v)

render, constraints = dim("render"), dim("constraints")
functional, polish = dim("functional"), dim("polish")

gated = render <= 0.0 or constraints <= 0.0
reward = 0.0 if gated else round(0.6 * functional + 0.4 * polish, 4)

if gated:
    failed = [n for n, v in (("render", render), ("constraints", constraints)) if v <= 0.0]
    print(f"[test.sh] gate failed ({', '.join(failed)}) -> reward 0")
else:
    print(f"[test.sh] 0.6*{functional} + 0.4*{polish} = {reward}")

d["reward"] = reward
d["gate_passed"] = not gated
json.dump(d, open(path, "w"), indent=2)
open(out, "w").write(f"{reward}\n")
SCORE
