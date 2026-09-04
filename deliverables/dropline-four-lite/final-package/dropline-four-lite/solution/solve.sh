#!/usr/bin/env bash
set -euo pipefail
mkdir -p /app
cp -R /solution/app/. /app/
cp /assets/artifacts/dropline_seed.xlsx /app/seed_data.xlsx
rm -f /app/dropline.db /app/dropline.db-shm /app/dropline.db-wal
test -s /app/server.js
test -s /app/public/index.html
test -s /app/seed_data.xlsx
echo "dropline-four-lite golden solution installed."
