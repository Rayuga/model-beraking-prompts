#!/bin/bash
# Build the Colderwater golden bundle outside the task folder, then copy the
# served files back. Keeps node_modules out of projects/ so solve.sh never
# copies a host-built dependency tree into /app.
#   usage: scripts/build_colderwater_golden.sh <scratch-build-dir>
set -euo pipefail

root="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
app="$root/projects/colderwater-playground-devtools/solution/app"
work="${1:?scratch build directory required}"

mkdir -p "$work/src" "$work/static"
cp "$app/package.json" "$app/package-lock.json" "$app/vite.config.mjs" "$app/tsconfig.json" "$app/index.html" "$work/"
cp "$app"/src/* "$work/src/"
cp "$app"/static/* "$work/static/"

cd "$work"
[ -d node_modules/vite ] || npm ci --ignore-scripts --no-audit --no-fund
npx vite build

mkdir -p "$app/public/assets"
cp "$work/public/index.html" "$work/public/runner.html" "$app/public/"
cp "$work"/public/assets/* "$app/public/assets/"
ls -la "$app/public" "$app/public/assets"
