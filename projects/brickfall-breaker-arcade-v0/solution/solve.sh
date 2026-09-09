#!/usr/bin/env bash
set -euo pipefail
mkdir -p /app
cp -R /solution/app/. /app/
cp /assets/artifacts/brickfall_seed.xlsx /app/seed_data.xlsx
cp /assets/artifacts/brickfall_scenarios.json /app/scenarios.json
rm -f /app/brickfall.db /app/brickfall.db-shm /app/brickfall.db-wal
test -s /app/server.js
test -s /app/public/index.html
test -s /app/seed_data.xlsx
test -s /app/scenarios.json
echo "brickfall-breaker-arcade golden solution installed."
