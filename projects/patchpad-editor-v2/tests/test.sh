#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"

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
  bash /tests/app-lifecycle.sh stop || true
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
paths = re.findall(r"^\s*(?:-\s+)?SQLite path:\s*([^\r\n]+)", manifest, re.MULTILINE | re.IGNORECASE)
assert len(paths) == 1, "Include one SQLite path: declaration in APP_MANIFEST.md"
value = paths[0].strip()
if value.startswith('`') and value.endswith('`'):
    value = value[1:-1]
assert Path(value).is_absolute(), "Database path must be absolute"
db = Path(value).resolve()
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
if ! bash /tests/app-lifecycle.sh start; then
  exit 0
fi

# Explicit readiness probe before grading. The lifecycle helper also waits on
# restarts; here require the browser entry itself, not just a healthy API.
if ! python3 - <<'PY' >>"$LOG_DIR/readiness.log" 2>&1
import time
import urllib.request

deadline = time.monotonic() + 60
while time.monotonic() < deadline:
    try:
        with urllib.request.urlopen('http://127.0.0.1:3000/', timeout=2) as response:
            response.read(1024)
        print('Application entry ready before grading')
        break
    except (OSError, TimeoutError) as error:
        print(f'Waiting for application entry: {error}', flush=True)
        time.sleep(.5)
else:
    raise SystemExit('Application entry did not become ready before grading')
PY
then
  write_zero_reward
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

# Constraints includes the required custom-document-surface prerequisite.
# No presentation or partial behavior credit survives a prohibited editor.
reward = 0.0 if data["render"] < 1.0 or data["constraints"] < 1.0 else 0.9 * data["functional"] + 0.1 * data["polish"]
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
