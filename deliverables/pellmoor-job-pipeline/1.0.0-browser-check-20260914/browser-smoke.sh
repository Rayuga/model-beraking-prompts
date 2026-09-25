#!/bin/bash
set -euo pipefail
mkdir -p /app /recruitment/records
cp /source/tests/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json
bash /source/solution/solve.sh
node /app/backend/server.js > /evidence/browser-app.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 30); do
  if node -e 'fetch("http://localhost:3000/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then break; fi
  sleep 1
done
node /evidence/browser-smoke.cjs
