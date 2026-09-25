#!/bin/bash
set -euo pipefail
mkdir -p /app /tests /assets/artifacts
cp -a /source/solution/. /app/
cp -a /source/tests/. /tests/
cp /source/environment/assets/artifacts/coursemark_seed.json /assets/artifacts/coursemark_seed.json
if [[ ! -x /usr/local/bin/chromium ]]; then
  browser_path="$(find /opt/playwright-browsers -type f -name chrome | head -n 1)"
  ln -s "$browser_path" /usr/local/bin/chromium
fi
node /app/server.js >/evidence/visual-startup.log 2>&1 &
app_pid=$!
trap 'kill "$app_pid" 2>/dev/null || true' EXIT
node /evidence/visual-review.cjs
