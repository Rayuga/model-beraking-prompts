#!/bin/bash
set -euo pipefail
# Reference solution: install the pre-built React/Vite/Tailwind + Express +
# SQLite app. The frontend is already compiled (public/ is the committed
# Vite build output; the Vite source itself isn't needed at solve time and
# isn't shipped here), so this is a plain file copy with no build step and
# no network dependency at solve time.
mkdir -p /app/public /app/src
cp "$(dirname "$0")/package.json" /app/package.json
cp "$(dirname "$0")/server.js" /app/server.js
cp -r "$(dirname "$0")/src/." /app/src/
cp -r "$(dirname "$0")/public/." /app/public/
rm -f /app/ridgeline.db /app/ridgeline.db-shm /app/ridgeline.db-wal
