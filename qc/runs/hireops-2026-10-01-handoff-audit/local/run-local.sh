#!/bin/bash
set -euo pipefail
mkdir -p /work/.tools/hireops/node_modules
ln -s /usr/local/lib/node_modules/express /work/.tools/hireops/node_modules/express
ln -s /usr/local/lib/node_modules/better-sqlite3 /work/.tools/hireops/node_modules/better-sqlite3
ln -s /usr/local/lib/node_modules/@playwright /work/.tools/hireops/node_modules/@playwright
ln -s /usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright /work/.tools/hireops/node_modules/playwright
ln -s /usr/local/bin/node /work/.tools/hireops/node.exe
export HIREOPS_BROWSER=/usr/local/bin/chromium
printf 'Node: '; node --version
printf 'Image browser: '; chromium --version
cd /work
node "/work/scripts/check_hireops_$1.cjs" "/evidence/$1"
