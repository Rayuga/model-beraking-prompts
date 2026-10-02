#!/bin/bash
set -euo pipefail
bash /solution/solve.sh
cd /tmp
exec node /app/server.js
