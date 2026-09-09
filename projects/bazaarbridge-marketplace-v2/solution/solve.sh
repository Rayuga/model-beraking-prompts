#!/bin/bash
set -euo pipefail
# Reference solution: install the Node.js + Express + SQLite app.
mkdir -p /app/public
cp "$(dirname "$0")/server.js" /app/server.js
cp "$(dirname "$0")/package.json" /app/package.json
cp "$(dirname "$0")/reference.html" /app/public/index.html
cp /assets/artifacts/bazaarbridge_seed_data.json /app/seed_data.json
rm -f /app/bazaarbridge.db /app/bazaarbridge.db-shm /app/bazaarbridge.db-wal
# Express and better-sqlite3 are preinstalled in the image and resolve through
# NODE_PATH. No package fetch or install is needed here, even when the
# environment has public networking.
