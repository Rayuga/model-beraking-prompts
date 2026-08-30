#!/usr/bin/env bash
set -euo pipefail
mkdir -p /app
cp -R /solution/app/. /app/
cd /app
rm -f oriel.db oriel.db-shm oriel.db-wal
export npm_config_bin_links=false
npm ci --omit=dev --no-audit --no-fund --no-bin-links
test -f APP_MANIFEST.md
echo "Oriel Permitworks golden solution installed."
