#!/usr/bin/env bash
# Oracle solve script — installs the golden Boardloom solution.
# Contract: /solution/ is mounted read-only; /app is the writable app root.
set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
chmod +x /app/start.sh 2>/dev/null || true
rm -f /app/backend/.env /app/.env 2>/dev/null || true
rm -f /app/backend/data/*.db /app/backend/data/*.db-* 2>/dev/null || true
rm -rf /app/backend/data/outbox 2>/dev/null || true

echo "[solve.sh] linking the image dependency set"
for half in backend frontend; do
  if [ -d "/opt/boardloom/${half}/node_modules" ] && [ ! -d "/app/${half}/node_modules" ]; then
    cp -a "/opt/boardloom/${half}/node_modules" "/app/${half}/node_modules"
  fi
done

echo "[solve.sh] done. APP_MANIFEST.md present:"
ls -la /app/APP_MANIFEST.md
