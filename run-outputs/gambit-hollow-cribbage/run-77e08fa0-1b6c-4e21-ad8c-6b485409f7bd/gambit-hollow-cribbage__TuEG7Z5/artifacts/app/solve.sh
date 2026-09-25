#!/bin/bash
set -euo pipefail
mkdir -p /app
cp -R /solution/. /app/
rm -f /app/gambit.db /app/gambit.db-shm /app/gambit.db-wal
test -s /app/serve.js
test -s /app/www/index.html
echo "Gambit Hollow golden solution installed."
