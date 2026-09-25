#!/bin/bash
set -euo pipefail
mkdir -p /app /assets/artifacts
cp -a /submission/. /app/
cp /seed/coursemark_seed.json /assets/artifacts/coursemark_seed.json
export DB_PATH=/tmp/coursemark-comparison.db
node /app/server.js >/evidence/${MODEL}-startup.log 2>&1 &
app_pid=$!
trap 'kill "$app_pid" 2>/dev/null || true' EXIT
node /evidence/compare-models.cjs
