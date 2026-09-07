#!/bin/bash
set -euo pipefail
# Reference solution: install the TypeScript + d3 + Express pipeline at the root
# the hosting note fixes, then build it with the dependencies already on the box.
ROOT="/app"
SRC="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/backend" "$ROOT/src" "$ROOT/public"
cp "$SRC/backend/server.js"   "$ROOT/backend/server.js"
cp "$SRC/backend/rules.js"    "$ROOT/backend/rules.js"
cp "$SRC/src/app.ts"          "$ROOT/src/app.ts"
cp "$SRC/public/index.html"   "$ROOT/public/index.html"
cp "$SRC/package.json"        "$ROOT/package.json"
cp "$SRC/tsconfig.json"       "$ROOT/tsconfig.json"
rm -f "$ROOT/pellmoor.db" "$ROOT/pellmoor.db-shm" "$ROOT/pellmoor.db-wal"
cd "$ROOT"
npm run build
