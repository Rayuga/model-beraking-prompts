#!/bin/bash
set -euo pipefail

mkdir -p /app/public
cp "$(dirname "$0")/package.json" /app/package.json
cp "$(dirname "$0")/server.js" /app/server.js
cp -r "$(dirname "$0")/public/." /app/public/
cp /assets/artifacts/coursemark_seed.json /app/seed_data.json
rm -f /app/coursemark.db /app/coursemark.db-shm /app/coursemark.db-wal
