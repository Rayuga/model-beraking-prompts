#!/bin/bash
set -euo pipefail
cp -a /solution/app/. /app/
cd /app
node server.js > /work/keyboard-server.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for step in $(seq 1 100); do if node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" > /dev/null 2>&1; then break; fi; sleep .1; done
node /work/keyboard-proof.cjs
