#!/bin/bash
set -euo pipefail
printf 'IMAGE_NODE_VERSION='
node --version
bash -n /solution/solve.sh
printf 'BASH_SYNTAX=OK\n'
sha256sum /solution/solve.sh /solution/app/server.js
bash /solution/solve.sh
printf 'INSTALL_EXIT=0\n'
cd /tmp
set +e
env -i PATH=/usr/local/bin:/usr/bin:/bin NODE_PATH=/usr/local/lib/node_modules HOME=/tmp PORT=3000 DB_PATH=/tmp/row19-frozen.db timeout 10s node /app/server.js
candidate_exit=$?
set -e
printf 'FROZEN_START_EXIT=%s\n' "$candidate_exit"
if [ "$candidate_exit" -eq 124 ]; then
  printf 'UNEXPECTED_RUNNING_CANDIDATE\n'
  exit 2
fi
printf 'CONTROL_ONLY: moving copied node_modules within disposable container\n'
mv /app/node_modules /tmp/row19-packaged-node_modules
node /evidence/row19-runtime-control.cjs
