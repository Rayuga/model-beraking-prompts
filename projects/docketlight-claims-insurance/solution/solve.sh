#!/bin/bash
set -euo pipefail
mkdir -p /app/public
cp "$(dirname "$0")/server.js" /app/server.js
cp "$(dirname "$0")/package.json" /app/package.json
cp "$(dirname "$0")/package-lock.json" /app/package-lock.json
cp "$(dirname "$0")/reference.html" /app/public/index.html
cp "$(dirname "$0")/app.js" /app/public/app.js
cp "$(dirname "$0")/styles.css" /app/public/styles.css
cp "$(dirname "$0")/APP_MANIFEST.md" /app/APP_MANIFEST.md
cp "$(dirname "$0")/Dockerfile" /app/Dockerfile
cp "$(dirname "$0")/restart-controller.py" /app/restart-controller.py
cp /assets/artifacts/docketlight_seed_data.json /app/seed_data.json
rm -f /app/docketlight.db /app/docketlight.db-shm /app/docketlight.db-wal
find /app -type f \( -name '*.db' -o -name '*.db-shm' -o -name '*.db-wal' \
  -o -name '*.db-journal' -o -name '*.sqlite' -o -name '*.sqlite3' \) -delete 2>/dev/null || true
rm -rf /app/node_modules
