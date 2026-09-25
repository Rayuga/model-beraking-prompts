#!/bin/bash
set -euo pipefail
mkdir -p /app /recruitment/records
cp -a /model/. /app/
cp /source/tests/pellmoor_seed_data.json /recruitment/records/pellmoor_seed_data.json
rm -f /app/pellmoor.db /app/pellmoor.db-wal /app/pellmoor.db-shm
chmod -R a+rX /app /recruitment
chown -R 65534:65534 /app
cd /app
env -i PATH=/usr/local/bin:/usr/bin:/bin NODE_PATH=/usr/local/lib/node_modules DB_PATH=/app/pellmoor.db setpriv --reuid=65534 --regid=65534 --clear-groups node /app/backend/server.js >/evidence/gpt-targeted-app.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 30); do
  if python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:3000/api/health')" 2>/dev/null; then break; fi
  sleep 0.2
done
python3 /evidence/gpt-targeted-probes.py
