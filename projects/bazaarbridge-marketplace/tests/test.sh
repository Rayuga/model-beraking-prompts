#!/bin/bash
set -euo pipefail
umask 077

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_COPY="/tmp/bazaarbridge-submission"
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

rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a /app/. "$APP_COPY/"
chown -R 65534:65534 "$APP_COPY"

setsid env -i \
  PATH="/usr/local/bin:/usr/bin:/bin" \
  NODE_PATH="/usr/local/lib/node_modules" \
  HOME="$APP_COPY" \
  PORT="3000" \
  DB_PATH="$APP_COPY/bazaarbridge.db" \
  setpriv --reuid=65534 --regid=65534 --clear-groups \
  node "$APP_COPY/server.js" >"$LOG_DIR/app.log" 2>&1 &
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

if ! timeout 3540 rewardkit /tests; then
  write_zero_reward
  exit 0
fi
