#!/bin/bash
set -euo pipefail
bash /solution/solve.sh
cd /app
exec node /app/server.js
