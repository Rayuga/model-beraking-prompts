#!/usr/bin/env bash
# Oracle solve script — installs the golden Signalworks solution.
# Contract: /solution/ is mounted read-only; /app is the writable app root.
set -euo pipefail

echo "[solve.sh] copying /solution/app -> /app"
mkdir -p /app
cp -R /solution/app/. /app/

cd /app
if [[ ! -f package-lock.json ]]; then
  echo "[solve.sh] package-lock.json is missing — cannot run npm ci" >&2
  exit 1
fi

# npm ci (not npm install) so the Oracle builds from the committed lockfile,
# matching what tests/test.py does for a submission that ships one.
echo "[solve.sh] installing npm dependencies from the lockfile"
ok=0
for attempt in 1 2 3; do
  rm -rf node_modules
  if npm ci --no-audit --no-fund --loglevel=error; then ok=1; break; fi
  echo "[solve.sh] npm ci attempt ${attempt}/3 failed — retrying"
  sleep $((attempt * 2))
done
if [[ "$ok" -ne 1 ]]; then echo "[solve.sh] npm ci failed after 3 attempts" >&2; exit 1; fi

echo "[solve.sh] done. APP_MANIFEST.md present:"
ls -la /app/APP_MANIFEST.md
