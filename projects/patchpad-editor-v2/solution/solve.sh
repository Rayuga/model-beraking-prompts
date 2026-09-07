#!/usr/bin/env bash
set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
cd /app

rm -f data/*.db data/*.db-* 2>/dev/null || true

test -d /opt/patchpad-deps/node_modules
echo "[solve.sh] using preinstalled node_modules from image"
rm -rf node_modules
cp -R /opt/patchpad-deps/node_modules ./node_modules

echo "[solve.sh] creating SQLite schema + seed"
node --experimental-sqlite -e "import('./src/db.js').then(() => console.log('seed ok'))"

test -f APP_MANIFEST.md
echo "[solve.sh] done"
