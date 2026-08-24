#!/usr/bin/env bash
set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
cd /app

rm -f data/*.db data/*.db-* 2>/dev/null || true

if [[ -d /opt/threadline-deps/node_modules ]]; then
  rm -rf node_modules
  cp -R /opt/threadline-deps/node_modules ./node_modules
else
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
fi

node --experimental-sqlite -e "import('./src/db.js').then(() => console.log('seed ok'))"
test -f APP_MANIFEST.md
echo "[solve.sh] done"
