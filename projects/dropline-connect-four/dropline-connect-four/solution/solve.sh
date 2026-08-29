#!/usr/bin/env bash
set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
cd /app

if [[ -d /opt/dropline-deps/node_modules ]]; then
  echo "[solve.sh] using preinstalled node_modules"
  rm -rf node_modules
  cp -R /opt/dropline-deps/node_modules ./node_modules
  cp /opt/dropline-deps/package-lock.json ./package-lock.json 2>/dev/null || true
else
  echo "[solve.sh] npm install fallback"
  npm install --omit=dev --no-audit --no-fund --loglevel=error
fi

npm test
test -f APP_MANIFEST.md
echo "[solve.sh] done"
