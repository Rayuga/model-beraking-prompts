#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/docketlight-submission"
APP_PID=""
NO_OP="1"

export VERIFIER_LOG_DIR="$LOG_DIR"

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":%s}\n' "$NO_OP" > "$LOG_DIR/reward.json"
  printf '{"results":{"tool":{"name":"rewardkit"},"summary":{"tests":5,"passed":0,"failed":5,"skipped":0,"pending":0,"other":0},"tests":[{"name":"render","status":"failed"},{"name":"constraints","status":"failed"},{"name":"functional","status":"failed"},{"name":"polish","status":"failed"},{"name":"visual","status":"failed"}]}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":%s}\n' "$NO_OP" > "$LOG_DIR/reward.json"
  test -s "$LOG_DIR/ctrf.json" || printf '{"results":{"tool":{"name":"rewardkit"},"summary":{"tests":5,"passed":0,"failed":5,"skipped":0,"pending":0,"other":0},"tests":[{"name":"render","status":"failed"},{"name":"constraints","status":"failed"},{"name":"functional","status":"failed"},{"name":"polish","status":"failed"},{"name":"visual","status":"failed"}]}}\n' > "$LOG_DIR/ctrf.json"
}

current_app_pid() {
  if [[ -f "$LOG_DIR/app.pid" ]]; then
    cat "$LOG_DIR/app.pid"
  else
    printf '%s\n' "$APP_PID"
  fi
}

cleanup() {
  if [[ -f "$LOG_DIR/restart-controller.pid" ]]; then
    kill "$(cat "$LOG_DIR/restart-controller.pid")" 2>/dev/null || true
  fi
  APP_PID="$(current_app_pid)"
  if [[ -n "$APP_PID" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  ensure_reward
}

write_zero_reward
trap cleanup EXIT

missing_files=0
for required_file in /app/server.js /app/public/index.html /app/seed_data.json /app/APP_MANIFEST.md /app/Dockerfile; do
  if [[ ! -f "$required_file" ]]; then
    printf 'Submitted app is missing required delivery file: %s (declared layout: node /app/server.js serving /app/public/index.html with seed_data.json, Dockerfile, and APP_MANIFEST.md beside it)\n' "$required_file" >&2
    missing_files=1
  fi
done
if ! grep -q 'node' /app/APP_MANIFEST.md 2>/dev/null || ! grep -q 'server\.js' /app/APP_MANIFEST.md 2>/dev/null; then
  printf 'APP_MANIFEST.md does not state the start command (node ... server.js)\n' >&2
  missing_files=1
fi
if ! grep -q 'FROM' /app/Dockerfile 2>/dev/null; then
  printf 'Dockerfile does not declare a FROM base image\n' >&2
  missing_files=1
fi
if [[ "$missing_files" == "1" ]]; then exit 0; fi

while IFS= read -r link; do
  rel="${link#/app/}"
  [[ "$rel" == node_modules/.bin/* ]] || exit 0
  target="$(readlink -f "$link" 2>/dev/null || true)"
  [[ -n "$target" && "$target" == /app/node_modules/* ]] || exit 0
done < <(find /app -type l -print 2>/dev/null)

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
find "$APP_COPY" -type d \( -name node_modules -o -name .git -o -name __pycache__ \
  -o -name .pytest_cache -o -name .ruff_cache \) -prune -exec rm -rf {} + 2>/dev/null || true
find "$APP_COPY" -type f \( \
  -name '*.db' -o -name '*.db-shm' -o -name '*.db-wal' -o -name '*.db-journal' \
  -o -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.sqlite3-shm' -o -name '*.sqlite3-wal' \
\) -delete 2>/dev/null || true
chown -R 65534:65534 "$APP_COPY"
chmod -R u+rwX "$APP_COPY"

APP_ENTRY="$APP_COPY/server.js"
APP_DB="$APP_COPY/docketlight.db"
APP_SEED="$APP_COPY/seed_data.json"

health_ready() {
  python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:3000/", timeout=2).read()' >/dev/null 2>&1
}

start_app() {
  if [[ -n "${APP_PID:-}" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  rm -f "$APP_DB" "$APP_DB-shm" "$APP_DB-wal"
  setsid env -i \
    PATH="/usr/local/bin:/usr/bin:/bin" \
    NODE_PATH="/usr/local/lib/node_modules" \
    HOME="$APP_COPY" \
    PORT="3000" \
    DB_PATH="$APP_DB" \
    SEED_PATH="$APP_SEED" \
    setpriv --reuid=65534 --regid=65534 --clear-groups \
    node "$APP_ENTRY" >"$LOG_DIR/app.log" 2>&1 &
  APP_PID="$!"
  printf '%s\n' "$APP_PID" > "$LOG_DIR/app.pid"
  local ready=0
  for _ in $(seq 1 240); do
    if health_ready; then ready=1; break; fi
    sleep 0.25
  done
  [[ "$ready" == "1" ]]
}

if ! start_app; then
  printf 'Submitted app did not become ready.\n'
  cat "$LOG_DIR/app.log" 2>/dev/null || true
  exit 0
fi

NO_OP=0
write_zero_reward

if [[ -z "${OPENAI_API_KEY:-}" || "${OPENAI_API_KEY}" == '${OPENAI_API_KEY}' ]]; then
  printf 'Verifier configuration error: OPENAI_API_KEY is missing or was not expanded by the platform.\n' >&2
  exit 0
fi

export DOCKETLIGHT_APP_ENTRY="$APP_ENTRY"
export DOCKETLIGHT_APP_COPY="$APP_COPY"
export DOCKETLIGHT_APP_DB="$APP_DB"
export DOCKETLIGHT_APP_SEED="$APP_SEED"

cat > "$LOG_DIR/restart-controller.py" <<'PY'
"""Verifier-owned localhost restart controller emitted inline by test.sh."""
import http.server
import json
import os
import signal
import subprocess
import time

LOG_DIR = os.environ.get("VERIFIER_LOG_DIR", "/logs/verifier")
PORT = 3199


def health_ok():
    try:
        import urllib.request
        urllib.request.urlopen("http://127.0.0.1:3000/", timeout=2).read()
        return True
    except Exception:
        return False


def restart():
    entry = os.environ["DOCKETLIGHT_APP_ENTRY"]
    copy = os.environ["DOCKETLIGHT_APP_COPY"]
    db = os.environ["DOCKETLIGHT_APP_DB"]
    seed = os.environ["DOCKETLIGHT_APP_SEED"]
    pid_path = os.path.join(LOG_DIR, "app.pid")
    old_pid = None
    if os.path.exists(pid_path):
        try:
            old_pid = int(open(pid_path, encoding="utf-8").read().strip() or 0)
        except (OSError, ValueError):
            old_pid = None
    if old_pid:
        try:
            os.killpg(old_pid, signal.SIGTERM)
        except OSError:
            pass
        for _ in range(60):
            try:
                os.kill(old_pid, 0)
            except OSError:
                old_pid = None
                break
            time.sleep(0.1)
        if old_pid:
            try:
                os.killpg(old_pid, signal.SIGKILL)
            except OSError:
                pass
    log = open(os.path.join(LOG_DIR, "app-restart.log"), "ab")
    child_env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "NODE_PATH": "/usr/local/lib/node_modules",
        "HOME": copy,
        "PORT": "3000",
        "DB_PATH": db,
        "SEED_PATH": seed,
    }
    argv = ["setsid", "env", "-i"]
    for key, value in child_env.items():
        argv.append(f"{key}={value}")
    argv += ["setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
             "node", entry]
    proc = subprocess.Popen(argv, stdin=subprocess.DEVNULL,
                            stdout=log, stderr=log)
    with open(pid_path, "w", encoding="utf-8") as handle:
        handle.write(str(proc.pid))
    ready = False
    for _ in range(240):
        if health_ok():
            ready = True
            break
        time.sleep(0.25)
    if not ready:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except OSError:
            pass
        raise RuntimeError("restarted application did not become ready")
    return {"ok": True, "restarted": True, "pid": proc.pid, "ready": True}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.rstrip("/") == "/restart":
            try:
                body = json.dumps(restart()).encode("utf-8")
                self.send_response(200)
            except Exception as exc:
                body = json.dumps(
                    {"ok": False, "restarted": False,
                     "error": f"{type(exc).__name__}: {exc}"}
                ).encode("utf-8")
                self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = json.dumps({"ok": True,
                           "service": "verifier-restart-controller"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        with open(os.path.join(LOG_DIR, "restart-controller.log"), "a",
                  encoding="utf-8") as log:
            log.write("[%s] %s\n"
                      % (time.strftime("%FT%TZ", time.gmtime()), fmt % args))


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT),
                                    Handler).serve_forever()
PY
chmod 700 "$LOG_DIR/restart-controller.py"

env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  HOME="$LOG_DIR" \
  VERIFIER_LOG_DIR="$LOG_DIR" \
  DOCKETLIGHT_APP_ENTRY="$APP_ENTRY" \
  DOCKETLIGHT_APP_COPY="$APP_COPY" \
  DOCKETLIGHT_APP_DB="$APP_DB" \
  DOCKETLIGHT_APP_SEED="$APP_SEED" \
  python3 "$LOG_DIR/restart-controller.py" >>"$LOG_DIR/restart-controller.out" 2>&1 &
CONTROLLER_PID=$!
printf '%s\n' "$CONTROLLER_PID" > "$LOG_DIR/restart-controller.pid"
controller_ready=0
for _ in $(seq 1 40); do
  if python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:3199/", timeout=1).read()' >/dev/null 2>&1; then
    controller_ready=1
    break
  fi
  sleep 0.1
done
if [[ "$controller_ready" != "1" ]]; then
  printf 'Verifier restart controller did not become ready.\n' >&2
  exit 0
fi
export DOCKETLIGHT_RESTART_URL="http://127.0.0.1:3199/restart"

if ! env PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers timeout 14600 rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  printf 'RewardKit failed before complete grading. See rewardkit.log.\n' >&2
  grep -E 'OPENAI_API_KEY|Missing environment|error|exception|traceback' "$LOG_DIR/rewardkit.log" 2>/dev/null | tail -n 30 >&2 || true
  write_zero_reward
  exit 0
fi

if ! python3 - "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" <<'PY'
import json, math, sys
from pathlib import Path
DIMENSIONS = ("render", "constraints", "functional", "polish", "visual")
j, t = Path(sys.argv[1]), Path(sys.argv[2]); data = json.loads(j.read_text())
for key in DIMENSIONS:
    value = data.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(float(value)) or not 0 <= float(value) <= 1:
        raise ValueError(f"invalid RewardKit dimension: {key}")
    data[key] = float(value)
ungated = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]
if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = ungated
reward = round(reward, 4)
data.update(
    reward=reward,
    ungated_score=round(ungated, 4),
    graded=1,
    no_op=0,
    criteria_timed_out=0,
    criteria_unprobed=0,
    judge_infra_error=0,
)
j.write_text(json.dumps(data, indent=2) + "\n"); t.write_text(f"{data['reward']:.4f}\n")
(j.parent / "ctrf.json").write_text(json.dumps({"results":{"tool":{"name":"rewardkit"},"summary":{"tests":5,"passed":sum(data[k]>0 for k in DIMENSIONS),"failed":sum(data[k]<=0 for k in DIMENSIONS),"skipped":0,"pending":0,"other":0},"tests":[{"name":k,"status":"passed" if data[k]>0 else "failed"} for k in DIMENSIONS] }}, indent=2)+"\n")
PY
then write_zero_reward; exit 0; fi
