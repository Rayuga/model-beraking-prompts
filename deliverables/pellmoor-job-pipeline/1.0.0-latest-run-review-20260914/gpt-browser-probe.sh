#!/bin/bash
set -euo pipefail
mkdir -p /app /recruitment/records
cp -a /submission/. /app/
cp /source/tests/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json
export NODE_PATH="/dependencies/node_modules:/usr/local/lib/node_modules"
export DB_PATH=/tmp/pellmoor-latest-gpt.db
node /app/backend/server.js > /evidence/gpt-app.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 20); do
  if node -e 'fetch("http://localhost:3000/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then break; fi
  sleep 1
done
node /evidence/gpt-browser-probe.cjs
