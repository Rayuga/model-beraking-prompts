#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/app}"

mkdir -p "$APP_DIR"
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

cp "$SOURCE_DIR/package.json" "$APP_DIR/package.json"
cp "$SOURCE_DIR/package-lock.json" "$APP_DIR/package-lock.json"
cp "$SOURCE_DIR/server.js" "$APP_DIR/server.js"
cp "$SOURCE_DIR/index.html" "$APP_DIR/index.html"
cp "$SOURCE_DIR/jsconfig.json" "$APP_DIR/jsconfig.json"
cp "$SOURCE_DIR/postcss.config.js" "$APP_DIR/postcss.config.js"
cp "$SOURCE_DIR/tailwind.config.js" "$APP_DIR/tailwind.config.js"
cp "$SOURCE_DIR/vite.config.js" "$APP_DIR/vite.config.js"
cp "$SOURCE_DIR/APP_MANIFEST.md" "$APP_DIR/APP_MANIFEST.md"
cp "$SOURCE_DIR/Dockerfile" "$APP_DIR/Dockerfile"
cp -R "$SOURCE_DIR/server" "$APP_DIR/server"
cp -R "$SOURCE_DIR/src" "$APP_DIR/src"
cp /assets/artifacts/customers_seed_data.json "$APP_DIR/customers_seed_data.json"
cp /assets/artifacts/shop_floor_seed_data.json "$APP_DIR/shop_floor_seed_data.json"
cp /assets/artifacts/staff_seed_data.json "$APP_DIR/staff_seed_data.json"

cd "$APP_DIR"
rm -rf "$APP_DIR/node_modules"
cp -a /opt/torquebay-deps/node_modules "$APP_DIR/node_modules"
npm run build
DB_PATH="$APP_DIR/torquebay.db" npm run seed

test -f "$APP_DIR/server.js"
test -f "$APP_DIR/public/index.html"
test -f "$APP_DIR/APP_MANIFEST.md"
