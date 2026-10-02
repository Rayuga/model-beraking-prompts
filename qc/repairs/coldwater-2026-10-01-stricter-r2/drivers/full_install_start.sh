#!/bin/bash
set -euo pipefail
if [ ! -f /app/.oracle-installed ]; then
  bash /solution/solve.sh
  touch /app/.oracle-installed
fi
cd /tmp
exec node /app/server.js
