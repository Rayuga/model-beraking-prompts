#!/bin/bash
# Install the golden with the task's own solve.sh into an empty /app (as the oracle does),
# hand /app to the unprivileged runtime user as test.sh does, then run the scripted
# golden checks against the installed copy (the driver launches node /app/server.js from
# another working directory with a cleared environment, as uid 65534, and restarts it).
set -euo pipefail
test -z "$(ls -A /app 2>/dev/null)" || { echo "/app is not empty" >&2; exit 1; }
bash /task/solution/solve.sh
echo "solve.sh installed: $(find /app -type f | wc -l) files"
chown -R 65534:65534 /app
setpriv --reuid=65534 --regid=65534 --clear-groups env NODE_PATH=/usr/local/lib/node_modules node /evidence/workspace.cjs
