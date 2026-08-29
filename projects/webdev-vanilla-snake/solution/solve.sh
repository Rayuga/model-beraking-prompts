#!/bin/bash
set -euo pipefail
# Oracle solution: install the reference implementation as the deliverable.
mkdir -p /app
cp "$(dirname "$0")/reference.html" /app/index.html
