#!/bin/bash
set -euo pipefail
cp -a /solution/. /app/
cd /app
node serve.js > /evidence/acceptance-app.log 2>&1 &
node /evidence/browser-acceptance.cjs
