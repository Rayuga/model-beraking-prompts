#!/usr/bin/env bash
# Oracle solve script — installs the golden GearVault Postgres app.
# Contract: /solution/ is mounted read-only; /app is the writable app root.

set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
cd /app

rm -f data/*.db data/*.db-* 2>/dev/null || true

# Prefer image-baked deps (no npm network during oracle). Fall back to npm install.
if [[ -d /opt/gearvault-deps/node_modules ]]; then
  echo "[solve.sh] using preinstalled node_modules from image"
  rm -rf node_modules
  cp -R /opt/gearvault-deps/node_modules ./node_modules
  # Do NOT copy /opt/gearvault-deps/package-lock.json over ours. That lockfile
  # describes the image's scratch `npm init -y` package, not this app; copying it
  # would leave `npm ci` resolving against a manifest that does not match our
  # package.json. The golden ships its own lockfile and it stays.
else
  echo "[solve.sh] npm install fallback"
  npm install --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
fi

echo "[solve.sh] creating Postgres schema + seed"
if [[ -f /opt/gearvault-postgres/start.sh ]]; then
  bash /opt/gearvault-postgres/start.sh
fi
node -e "import('./src/db.js').then(async (m) => { console.log('seed ok'); await m.sql.end({ timeout: 5 }); })"

test -f APP_MANIFEST.md
echo "[solve.sh] done. APP_MANIFEST.md present:"
ls -la /app/APP_MANIFEST.md
