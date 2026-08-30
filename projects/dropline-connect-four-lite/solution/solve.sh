#!/usr/bin/env bash
set -euo pipefail
mkdir -p /app
cp -R /solution/app/. /app/
test -s /app/index.html
echo "DropLine Lite golden solution installed."
