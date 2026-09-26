#!/bin/bash
set -euo pipefail

mkdir -p /app
cp -a "$(dirname "$0")/app/." /app/
