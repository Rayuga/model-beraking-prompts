#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/common-ground-submission"
SCORE_FINALIZED=0

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  local tmp_txt tmp_json
  tmp_txt="$(mktemp "$LOG_DIR/.reward.txt.XXXXXX")"
  tmp_json="$(mktemp "$LOG_DIR/.reward.json.XXXXXX")"
  printf '0.0\n' > "$tmp_txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$tmp_json"
  mv -f "$tmp_txt" "$LOG_DIR/reward.txt"
  mv -f "$tmp_json" "$LOG_DIR/reward.json"
  printf '{"tool":{"name":"rewardkit"},"tests":[],"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

cleanup() {
  python3 /tests/app-lifecycle.py stop 2>/dev/null || true
  if [[ "$SCORE_FINALIZED" != "1" ]]; then write_zero_reward; fi
  ensure_reward
}

write_zero_reward
trap cleanup EXIT
trap 'exit 0' TERM INT HUP
python3 /tests/prompt-provenance.py "$LOG_DIR/prompt-provenance.json"

if [[ ! -f /app/server.js ]]; then exit 0; fi
while IFS= read -r app_link; do
  resolved_link="$(readlink -f -- "$app_link" 2>/dev/null || true)"
  case "$resolved_link" in
    /app/*|/usr/local/lib/node_modules/*) ;;
    *) exit 0 ;;
  esac
done < <(find /app -type l -print 2>/dev/null)

if [[ ! -f /app/common_ground_seed.json ]]; then exit 0; fi

rm -f /app/commonground.db /app/commonground.db-shm /app/commonground.db-wal
chmod -R a+rX /app 2>/dev/null || true
find /app -type f -exec chmod a+r {} + 2>/dev/null || true
chown -R 65534:65534 /app 2>/dev/null || true

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
chown -R 65534:65534 "$APP_COPY"
chmod -R a+rX "$APP_COPY"

APP_ENTRY="/app/server.js"
APP_DB="/app/commonground.db"
APP_SEED="/app/common_ground_seed.json"
if ! setpriv --reuid=65534 --regid=65534 --clear-groups test -w /app 2>/dev/null; then
  APP_ENTRY="$APP_COPY/server.js"
  APP_DB="$APP_COPY/commonground.db"
  APP_SEED="$APP_COPY/common_ground_seed.json"
fi

python3 /tests/app-lifecycle.py start --entry "$APP_ENTRY" \
  --database "$APP_DB" --seed "$APP_SEED" --log "$LOG_DIR/app.log"

READY=0
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" != "1" ]]; then exit 0; fi

if ! timeout 12600 rewardkit --max-concurrent-agent 1 /tests >"$LOG_DIR/rewardkit.log" 2>&1; then
  write_zero_reward
  exit 0
fi

if ! python3 /tests/score.py "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" "$LOG_DIR/ctrf.json"
then
  write_zero_reward
  exit 0
fi
SCORE_FINALIZED=1
