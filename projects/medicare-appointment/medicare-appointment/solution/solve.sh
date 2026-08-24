#!/usr/bin/env bash
# Oracle solve script — installs the golden MedCare SQLite app.
# Contract: /solution/ is mounted read-only; /app is the writable app root.

set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
cd /app

rm -f data/*.db data/*.db-* 2>/dev/null || true

# Prefer image-baked deps (no npm network during oracle). Fall back to npm install.
if [[ -d /opt/medcare-deps/node_modules ]]; then
  echo "[solve.sh] using preinstalled node_modules from image"
  rm -rf node_modules
  cp -R /opt/medcare-deps/node_modules ./node_modules
  cp /opt/medcare-deps/package-lock.json ./package-lock.json 2>/dev/null || true
else
  echo "[solve.sh] npm install fallback"
  npm install --omit=dev --no-audit --no-fund --loglevel=error
fi

echo "[solve.sh] creating SQLite schema + seed"
node --experimental-sqlite -e "import('./src/db.js').then(() => console.log('seed ok'))"

test -f APP_MANIFEST.md
echo "[solve.sh] done. APP_MANIFEST.md present:"
ls -la /app/APP_MANIFEST.md
