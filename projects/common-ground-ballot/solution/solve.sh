#!/bin/bash
set -euo pipefail

mkdir -p /app/public
cp "$(dirname "$0")/package.json" /app/package.json
cp "$(dirname "$0")/server.js" /app/server.js
cp -r "$(dirname "$0")/public/." /app/public/
rm -f /app/commonground.db /app/commonground.db-shm /app/commonground.db-wal
