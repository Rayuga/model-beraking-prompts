#!/bin/bash
set -euo pipefail
SOURCE="$(cd -- "$(dirname -- "$0")" && pwd)"
mkdir -p /app/public/js /app/src
cp "$SOURCE/package.json" "$SOURCE/server.js" "$SOURCE/APP_MANIFEST.md" /app/
cp -r "$SOURCE/src/." /app/src/
cp -r "$SOURCE/public/." /app/public/
