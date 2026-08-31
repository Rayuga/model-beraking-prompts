#!/usr/bin/env bash
set -euo pipefail
mkdir -p /app
cp -R /solution/app/. /app/
rm -f /app/dropline.db /app/dropline.db-shm /app/dropline.db-wal
test -s /app/server.js
test -s /app/public/index.html
echo "DropLine Lite golden solution installed."
