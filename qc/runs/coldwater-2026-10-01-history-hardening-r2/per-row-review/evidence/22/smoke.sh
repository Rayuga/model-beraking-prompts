#!/bin/bash
set -euo pipefail
echo 'Row 22 isolated verifier toolchain smoke; this does not invoke a grading model.'
node --version
python3 --version
claude --version
codex --version
playwright-mcp --version
rewardkit --help
python3 - <<'PY'
import importlib.metadata
print('harbor-rewardkit', importlib.metadata.version('harbor-rewardkit'))
import rewardkit
print('rewardkit_import', rewardkit.__file__)
from pathlib import Path
import hashlib,json
print('image_test_hashes',json.dumps({str(p.relative_to('/tests')):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()},sort_keys=True))
PY
mkdir -p /app /tmp/submission
cp -a /source/. /app/
chown -R 65534:65534 /app /tmp/submission
chmod -R a+rX /app
setsid env -i PATH=/usr/local/bin:/usr/bin:/bin NODE_PATH=/usr/local/lib/node_modules HOME=/tmp/submission PORT=3000 DB_PATH=/app/app.db setpriv --reuid=65534 --regid=65534 --clear-groups node /app/server.js >/tmp/row22-app.log 2>&1 &
APP_PID=$!
trap 'kill -- -"$APP_PID" 2>/dev/null || true' EXIT
node /evidence/browser-smoke.cjs
cat /tmp/row22-app.log
