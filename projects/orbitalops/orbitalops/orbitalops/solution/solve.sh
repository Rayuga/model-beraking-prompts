#!/bin/bash
set -euo pipefail
# Reference solution: install the Node.js + Express + SQLite app.
mkdir -p /app/public/js /app/src
cp "$(dirname "$0")/package.json" /app/package.json
cp "$(dirname "$0")/server.js" /app/server.js
cp -r "$(dirname "$0")/src/." /app/src/
cp -r "$(dirname "$0")/public/." /app/public/
cp /assets/artifacts/orbitalops_seed.xlsx /app/seed_data.xlsx 2>/dev/null || true
cp /assets/artifacts/orbitalops_seed.xlsx /app/src/seed_data.xlsx 2>/dev/null || true
rm -f /app/orbitalops.db /app/orbitalops.db-shm /app/orbitalops.db-wal
