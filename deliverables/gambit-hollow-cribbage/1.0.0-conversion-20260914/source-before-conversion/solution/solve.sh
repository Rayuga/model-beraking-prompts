#!/bin/bash
set -euo pipefail
# Reference solution. No build step: the drawn stack is plain HTML, CSS and
# JavaScript with inline SVG, served as written.
ROOT="/home/build/gambit-hollow-board-games"
SRC="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/lib" "$ROOT/www/js"
cp "$SRC/serve.js"           "$ROOT/serve.js"
cp "$SRC/lib/scoring.js"     "$ROOT/lib/scoring.js"
cp "$SRC/lib/game.js"        "$ROOT/lib/game.js"
cp "$SRC/www/index.html"     "$ROOT/www/index.html"
cp "$SRC/www/js/cards.js"    "$ROOT/www/js/cards.js"
cp "$SRC/www/js/app.js"      "$ROOT/www/js/app.js"
cp "$SRC/package.json"       "$ROOT/package.json"
rm -f "$ROOT/gambit.db" "$ROOT/gambit.db-shm" "$ROOT/gambit.db-wal"
cd "$ROOT"
npm install --no-audit --no-fund
