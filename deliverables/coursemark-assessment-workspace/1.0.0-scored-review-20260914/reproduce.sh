#!/bin/bash
set -euo pipefail
mkdir -p /app
cp -a /submission/. /app/
export DB_PATH=/tmp/scored-review.db
node /app/server.js >/evidence/${MODEL}-startup.log 2>&1 &
app_pid=$!
trap 'kill "$app_pid" 2>/dev/null || true' EXIT
node /evidence/reproduce.cjs
