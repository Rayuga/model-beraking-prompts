#!/usr/bin/env bash
# Oracle solve script — stages the golden DrawBill SQLite app into /app.
# Contract: /solution/ is mounted read-only; /app is the writable app root.
# The product boots from APP_MANIFEST.md (`npm start` → src/index.js on port 3000).
# Driver copy: tests/__judge__/run_judge.py.
set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/
cd /app

rm -rf node_modules data
rm -f ./*.db ./*.db-wal ./*.db-shm data/*.db data/*.db-* 2>/dev/null || true

echo "[solve.sh] copying seed JSON into /app/artifacts"
mkdir -p /app/artifacts
if [[ -d /assets/artifacts ]]; then
  cp -a /assets/artifacts/. /app/artifacts/
fi

# The frozen set is already resolved in the image at /opt/drawbill-deps. Stage
# that tree rather than resolving it again: this phase has no registry, and the
# reference must not need one either.
echo "[solve.sh] staging the frozen dependency tree"
DEPS=/opt/drawbill-deps/node_modules
if [[ ! -d "$DEPS/express" ]]; then
  echo "[solve.sh] $DEPS is missing from this image" >&2
  exit 1
fi
rm -rf /app/node_modules
cp -a "$DEPS" /app/node_modules
test -d /app/node_modules/express

echo "[solve.sh] done."
ls -la /app/APP_MANIFEST.md
