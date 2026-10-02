#!/bin/sh
# Isolated POSIX reproduction of the unbounded wait in tests/test.sh:33-39.
set -eu
setsid sh -c 'trap "" TERM; while :; do sleep 1; done' >/dev/null 2>&1 &
app_pid=$!
sleep 1
kill -TERM -- -"$app_pid" 2>/dev/null || true
(sleep 3; kill -KILL -- -"$app_pid" 2>/dev/null || true) &
watchdog_pid=$!
start=$(date +%s)
wait "$app_pid" 2>/dev/null || true
elapsed=$(($(date +%s) - start))
wait "$watchdog_pid" 2>/dev/null || true
printf 'wait_elapsed_seconds=%s\n' "$elapsed"
