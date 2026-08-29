#!/bin/bash
set -euo pipefail
mkdir -p /app
cp "$(dirname "$0")/reference.html" /app/index.html
