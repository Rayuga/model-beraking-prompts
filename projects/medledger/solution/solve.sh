#!/usr/bin/env bash
# Oracle solve script — installs the golden MedLedger app.
set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
cd /app

rm -f data/*.db data/*.db-* 2>/dev/null || true

if [[ -d /opt/medledger-deps/node_modules ]]; then
  echo "[solve.sh] using preinstalled node_modules from image"
  rm -rf node_modules
  cp -R /opt/medledger-deps/node_modules ./node_modules
  cp /opt/medledger-deps/package-lock.json ./package-lock.json 2>/dev/null || true
else
  echo "[solve.sh] npm install fallback"
  npm install --no-audit --no-fund --loglevel=error
fi

echo "[solve.sh] building UI"
npm run build

echo "[solve.sh] seeding SQLite"
node --experimental-sqlite -e "import('./server/db.js').then(()=>console.log('seed ok'))"

test -f APP_MANIFEST.md
echo "[solve.sh] done"
