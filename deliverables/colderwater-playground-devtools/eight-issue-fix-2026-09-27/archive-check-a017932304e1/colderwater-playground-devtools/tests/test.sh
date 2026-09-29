#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/submission"
APP_PID=""
ZERO_REWARD_JSON='{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"gates_passed":0,"floors_passed":0,"weighted_score":0.0,"graded":0,"no_op":1}'

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '%s\n' "$ZERO_REWARD_JSON" > "$LOG_DIR/reward.json"
  printf '{"tests":[],"tool":{"name":"rewardkit"},"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '%s\n' "$ZERO_REWARD_JSON" > "$LOG_DIR/reward.json"
}

current_app_pid() {
  if [[ -f "$LOG_DIR/app.pid" ]]; then
    cat "$LOG_DIR/app.pid"
  else
    printf '%s\n' "$APP_PID"
  fi
}

app_group_has_live_processes() {
  ps -eo pgid=,stat= | awk -v group="$1" '$1 == group && $2 !~ /^[ZX]/ { alive=1 } END { exit !alive }'
}

cleanup() {
  local exit_status=$?
  ensure_reward
  APP_PID="$(current_app_pid)"
  if [[ "$APP_PID" =~ ^[0-9]+$ ]] && (( APP_PID > 1 )); then
    kill -- -"$APP_PID" 2>/dev/null || true
    for _ in $(seq 1 50); do
      app_group_has_live_processes "$APP_PID" || break
      sleep 0.1
    done
    if app_group_has_live_processes "$APP_PID"; then
      kill -KILL -- -"$APP_PID" 2>/dev/null || true
      for _ in $(seq 1 20); do
        app_group_has_live_processes "$APP_PID" || break
        sleep 0.1
      done
    fi
    if app_group_has_live_processes "$APP_PID"; then
      printf 'test.sh: application process group did not stop during cleanup\n' >&2
    fi
    if ! ps -p "$APP_PID" -o stat= | awk '$1 !~ /^[ZX]/ { alive=1 } END { exit !alive }'; then
      wait "$APP_PID" 2>/dev/null || true
    fi
  fi
  return "$exit_status"
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

if [[ -z "${REWARDKIT_JUDGE:-}" || -z "${REWARDKIT_MODEL:-}" ]]; then
  printf 'test.sh: set REWARDKIT_JUDGE and REWARDKIT_MODEL in task.toml [verifier.env]\n' >&2
  exit 0
fi

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
chmod -R a+rX /assets 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"
chmod -R u+rwX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/app.db"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/app.db"
fi

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="$APP_DB" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  sh -c 'cd "$(dirname "$1")" && exec node "$1"' app-launch "$APP_ENTRY" >"$LOG_DIR/app.log" 2>&1 &
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

cat > "$LOG_DIR/app-restart.sh" <<'SH'
#!/bin/bash
set -euo pipefail
group_has_live_processes() {
  ps -eo pgid=,stat= | awk -v group="$1" '$1 == group && $2 !~ /^[ZX]/ { alive=1 } END { exit !alive }'
}
process_is_alive() {
  ps -p "$1" -o stat= | awk '$1 !~ /^[ZX]/ { alive=1 } END { exit !alive }'
}
probe_ready() {
  python3 - <<'PY' >/dev/null 2>&1
import sys
import urllib.error
import urllib.request

for url in ("http://127.0.0.1:3000/api/health", "http://127.0.0.1:3000/"):
    try:
        urllib.request.urlopen(url, timeout=2).read(1)
    except urllib.error.HTTPError:
        sys.exit(0)
    except Exception:
        continue
    sys.exit(0)
sys.exit(1)
PY
}
LOG_DIR="__LOG_DIR__"
if [[ ! -f "$LOG_DIR/app.pid" ]]; then
  printf 'app-restart: no app.pid; cannot restart\n' >&2
  exit 1
fi
old_pid="$(cat "$LOG_DIR/app.pid")"
if [[ -n "$old_pid" ]]; then
  kill -- "-$old_pid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    group_has_live_processes "$old_pid" || break
    sleep 0.1
  done
  if group_has_live_processes "$old_pid"; then
    kill -KILL -- "-$old_pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      group_has_live_processes "$old_pid" || break
      sleep 0.1
    done
  fi
  if group_has_live_processes "$old_pid"; then
    printf 'app-restart: original process group did not stop\n' >&2
    exit 1
  fi
fi
if probe_ready; then
  printf 'app-restart: another listener remains after stopping the application\n' >&2
  exit 1
fi
setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="__APP_COPY__" \
  PORT="3000" \
  DB_PATH="__APP_DB__" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  sh -c 'cd "$(dirname "$1")" && exec node "$1"' app-launch "__APP_ENTRY__" >>"$LOG_DIR/app-restart.log" 2>&1 &
new_pid=$!
printf '%s\n' "$new_pid" > "$LOG_DIR/app.pid"
ready=0
deadline=$((SECONDS + 30))
while (( SECONDS < deadline )); do
  if ! process_is_alive "$new_pid"; then
    printf 'app-restart: replacement process exited before becoming ready\n' >&2
    exit 1
  fi
  if probe_ready; then
    sleep 0.1
    if ! process_is_alive "$new_pid"; then
      printf 'app-restart: replacement process exited during readiness\n' >&2
      exit 1
    fi
    ready=1
    break
  fi
  sleep 0.25
done
printf 'app-restart pid=%s ready=%s at %s\n' "$new_pid" "$ready" "$(date -u +%FT%TZ)" >> "$LOG_DIR/app-restart.log"
if [[ "$ready" != "1" ]]; then
  printf 'app-restart: application did not answer HTTP within 30 seconds\n' >&2
  exit 1
fi
exit 0
SH
sed -i \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  -e "s|__APP_ENTRY__|$APP_ENTRY|g" \
  -e "s|__APP_COPY__|$APP_COPY|g" \
  -e "s|__APP_DB__|$APP_DB|g" \
  "$LOG_DIR/app-restart.sh"
chmod 755 "$LOG_DIR/app-restart.sh"
rm -f "$LOG_DIR/app-restart.sh.used"
export APP_RESTART_HELPER="$LOG_DIR/app-restart.sh"

python3 - <<'PY'
from pathlib import Path

context = Path("/tests/app_context.md").read_text().strip()
for prompt in Path("/tests").glob("*/*/prompt.md"):
    prompt.write_text(prompt.read_text().replace("{app_context}", context))
PY

validate_suite() {
  local suite="$1" suite_status="$2"
  if python3 - "$LOG_DIR" "$suite" "$suite_status" <<'PY'
import json
import math
import sys
import tomllib
from pathlib import Path

log_dir, suite, exit_status = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3])
issues = []
specs = {
    path.parent.name: tomllib.loads(path.read_text())
    for path in (Path('/tests') / suite).glob('*/judge.toml')
}

def unit_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1

if exit_status:
    issues.append({'kind': 'suite_process_error', 'exit_status': exit_status})
else:
    try:
        scores = json.loads((log_dir / suite / 'reward.json').read_text())
        details = json.loads((log_dir / suite / 'reward-details.json').read_text())
        if not isinstance(scores, dict) or set(scores) != set(specs):
            raise ValueError('reward dimensions do not match the submitted suite')
        if not isinstance(details, dict) or set(details) != set(specs):
            raise ValueError('detail dimensions do not match the submitted suite')
        for dimension, spec in specs.items():
            if not unit_number(scores[dimension]):
                raise ValueError(f'{dimension}: invalid normalized dimension value')
            detail = details[dimension]
            if not isinstance(detail, dict) or not unit_number(detail.get('score')):
                raise ValueError(f'{dimension}: invalid dimension detail')
            if detail['score'] != scores[dimension]:
                raise ValueError(f'{dimension}: summary and detail scores disagree')
            rows = detail.get('criteria')
            expected = {criterion['name']: criterion for criterion in spec['criterion']}
            if not isinstance(rows, list) or len(rows) != len(expected):
                raise ValueError(f'{dimension}: missing or extra criterion verdicts')
            if any(not isinstance(row, dict) for row in rows):
                raise ValueError(f'{dimension}: malformed criterion verdict')
            by_name = {row.get('name'): row for row in rows}
            if set(by_name) != set(expected):
                raise ValueError(f'{dimension}: criterion identities do not match the submitted rubric')
            for name, criterion in expected.items():
                row = by_name[name]
                if row.get('id') != criterion['id'] or not unit_number(row.get('value')):
                    raise ValueError(f'{dimension}/{name}: invalid criterion identity or value')
                if row.get('weight') != criterion.get('weight', 1):
                    raise ValueError(f'{dimension}/{name}: criterion weight differs from the submitted rubric')
                if row.get('error') is not None:
                    issues.append({'dimension': dimension, 'criterion': name, 'kind': 'judge_error', 'error': str(row['error'])})
                    continue
                reasoning = row.get('reasoning')
                if not isinstance(reasoning, str):
                    raise ValueError(f'{dimension}/{name}: missing or malformed reasoning')
                if reasoning.lstrip().startswith('EVALUATION_INCOMPLETE:'):
                    issues.append({'dimension': dimension, 'criterion': name, 'kind': 'incomplete_observation', 'reasoning': reasoning})
                raw = row.get('raw')
                if criterion.get('type', 'binary') == 'binary':
                    if isinstance(raw, str) and raw.strip().lower() in ('yes', 'no', 'true', 'false', '1', '0'):
                        expected_value = int(raw.strip().lower() in ('yes', 'true', '1'))
                    elif isinstance(raw, bool):
                        expected_value = int(raw)
                    elif isinstance(raw, (int, float)) and math.isfinite(raw) and raw in (0, 1):
                        expected_value = int(raw)
                    else:
                        raise ValueError(f'{dimension}/{name}: invalid binary verdict')
                    if row['value'] != expected_value:
                        raise ValueError(f'{dimension}/{name}: inconsistent binary verdict')
                elif criterion['type'] == 'likert':
                    if not isinstance(raw, (int, float, str)) or isinstance(raw, bool):
                        raise ValueError(f'{dimension}/{name}: invalid Likert verdict')
                    raw_number = float(raw)
                    if not math.isfinite(raw_number) or not raw_number.is_integer() or not 1 <= raw_number <= criterion['points']:
                        raise ValueError(f'{dimension}/{name}: invalid Likert verdict')
                    if not math.isclose(row['value'], (raw_number - 1) / (criterion['points'] - 1), abs_tol=0.0001):
                        raise ValueError(f'{dimension}/{name}: inconsistent Likert verdict')
    except (OSError, ValueError, TypeError, KeyError) as exc:
        issues.append({'kind': 'invalid_report', 'error': str(exc)})

if issues:
    diagnostic = {'status': 'evaluation_incomplete', 'suite': suite, 'valid_application_grade': False, 'issues': issues}
    (log_dir / 'evaluation-incomplete.json').write_text(json.dumps(diagnostic, indent=2) + '\n')
    print(f'test.sh: {suite} evaluation incomplete; see evaluation-incomplete.json', file=sys.stderr)
    sys.exit(1)
PY
  then
    return 0
  fi
  write_zero_reward
  return 1
}

run_suite() {
  local suite="$1" budget_sec="$2"
  local suite_status=0
  rm -rf "$LOG_DIR/$suite"
  mkdir -p "$LOG_DIR/$suite"
  timeout "$budget_sec" rewardkit --max-concurrent-agent 1 \
    --output "$LOG_DIR/$suite/reward.json" "/tests/$suite" \
    >"$LOG_DIR/$suite/rewardkit.log" 2>&1 || suite_status=$?
  validate_suite "$suite" "$suite_status"
}

rm -f "$LOG_DIR/evaluation-incomplete.json"
rm -rf "$LOG_DIR/scored"
if ! run_suite gates 1500; then
  exit 0
fi
gates_status=0
python3 /tests/tools/score.py "$LOG_DIR" || gates_status=$?
case "$gates_status" in
  0) ;;
  1) exit 0 ;;
  *) write_zero_reward; exit 0 ;;
esac

if ! run_suite scored 11100; then
  exit 0
fi
python3 /tests/tools/score.py "$LOG_DIR" || write_zero_reward
