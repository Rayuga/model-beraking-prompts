#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/coursemark-submission"
PROBE="/tmp/coursemark-probe.py"
APP_PID=""

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '{"tests":[],"tool":{"name":"rewardkit"},"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

cleanup() {
  if [[ -s "$LOG_DIR/app.pid" ]]; then
    APP_PID="$(cat "$LOG_DIR/app.pid")"
    [[ "$APP_PID" =~ ^[0-9]+$ && "$APP_PID" -gt 1 ]] || APP_PID=""
  fi
  if [[ -n "$APP_PID" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL -- -"$APP_PID" 2>/dev/null || true
  fi
  python3 /tests/evidence.py export-traces > "$LOG_DIR/trace-export.log" 2>&1 || true
  ensure_reward
}

write_zero_reward
trap cleanup EXIT

if ! python3 - "$LOG_DIR/prompt-provenance.json" <<'PY'
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path('/tests')
sha256 = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
record = {"task": "coursemark-assessment-workspace", "task_version": "1.0.0", "judges": {}}
for dimension in ("render", "constraints", "functional", "polish", "visual"):
    prompt = root / dimension / 'prompt.md'
    text = prompt.read_text(encoding='utf-8')
    task_version = re.search(r'^Task version: (.+)$', text, re.MULTILINE)
    prompt_version = re.search(r'^Prompt version: (.+)$', text, re.MULTILINE)
    if not task_version or task_version.group(1).strip() != record['task_version'] or not prompt_version:
        raise ValueError(f'Missing or inconsistent prompt version: {dimension}')
    record['judges'][dimension] = {
        'task_version': task_version.group(1).strip(),
        'prompt_version': prompt_version.group(1).strip(),
        'prompt_sha256': sha256(prompt),
        'judge_sha256': sha256(root / dimension / 'judge.toml'),
    }
record['runner_sha256'] = sha256(root / 'test.sh')
record['reward_config_sha256'] = sha256(root / 'reward.toml')
record['evidence_helper_sha256'] = sha256(root / 'evidence.py')
record['browser_proxy_sha256'] = sha256(root / 'playwright-proxy.py')
Path(sys.argv[1]).write_text(json.dumps(record, indent=2) + '\n')
print('Prompt provenance: ' + json.dumps(record, sort_keys=True), flush=True)
PY
then
  write_zero_reward
  exit 0
fi

if [[ ! -s /app/server.js || ! -s /app/public/index.html ]]; then
  printf 'Verifier stopped: required application entry files are missing.\n'
  exit 0
fi

if ! python3 - <<'PY'
from rewardkit.runner import discover
rewards = discover('/tests')
assert {reward.name for reward in rewards} == {'render', 'constraints', 'functional', 'polish', 'visual'}
print('RewardKit discovery passed: all five dimensions loaded.', flush=True)
PY
then
  printf 'Verifier configuration failed during RewardKit discovery; no criteria were graded.\n'
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
    if target != root and root not in target.parents:
        raise SystemExit(1)
PY
then
  exit 0
fi

rm -f /app/coursemark.db /app/coursemark.db-shm /app/coursemark.db-wal
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
rm -f "$APP_COPY/coursemark.db" "$APP_COPY/coursemark.db-shm" "$APP_COPY/coursemark.db-wal"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/coursemark.db"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/coursemark.db"
fi

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="$APP_DB" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  bash -c 'cd "$(dirname "$1")" && exec node "$1"' _ "$APP_ENTRY" >"$LOG_DIR/app.log" 2>&1 &
APP_PID="$!"
printf '%s\n' "$APP_PID" > "$LOG_DIR/app.pid"
printf '%s\n' "$APP_ENTRY" > "$LOG_DIR/app-entry"
printf '%s\n' "$APP_DB" > "$LOG_DIR/app-db"

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
  if python3 "$PROBE" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  printf 'Verifier stopped: application readiness failed; inspect app.log.\n'
  exit 0
fi

python3 /tests/evidence.py initialize > "$LOG_DIR/trace-setup.json"
COURSEMARK_CODEX_BIN="$(command -v codex)"
export COURSEMARK_CODEX_BIN
COURSEMARK_PLAYWRIGHT_BIN="$(command -v playwright-mcp)"
export COURSEMARK_PLAYWRIGHT_BIN
TRACE_BIN="$(mktemp -d /tmp/coursemark-verifier-tools.XXXXXX)"
printf '%s\n' '#!/bin/sh' 'exec python3 /tests/evidence.py trace-codex "$@"' > "$TRACE_BIN/codex"
printf '%s\n' '#!/bin/sh' 'exec python3 /tests/playwright-proxy.py "$@"' > "$TRACE_BIN/playwright-mcp"
chmod 700 "$TRACE_BIN/playwright-mcp"
chmod 700 "$TRACE_BIN/codex"

if ! PATH="$TRACE_BIN:$PATH" timeout 12600 rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  printf 'Verifier stopped: RewardKit failed or timed out; inspect rewardkit.log. No completed grade is claimed.\n'
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
  printf 'Verifier stopped: invalid or missing dimension scores.\n'
  write_zero_reward
  exit 0
fi
