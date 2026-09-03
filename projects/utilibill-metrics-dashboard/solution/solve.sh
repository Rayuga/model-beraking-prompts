#!/bin/bash
set -euo pipefail
# Reference solution: install the Node.js + Express + SQLite app.
mkdir -p /app/public/js /app/src
cp "$(dirname "$0")/package.json" /app/package.json
cp "$(dirname "$0")/server.js" /app/server.js
cp -r "$(dirname "$0")/src/." /app/src/
cp -r "$(dirname "$0")/public/." /app/public/
cp /assets/artifacts/utilibill_seed.json /app/seed_data.json 2>/dev/null || true
cp /assets/artifacts/utilibill_seed.json /app/src/seed_data.json 2>/dev/null || true
rm -f /app/utilibill.db /app/utilibill.db-shm /app/utilibill.db-wal
