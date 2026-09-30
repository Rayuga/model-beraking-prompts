#!/bin/bash
set -euo pipefail
mkdir -p /app
cp -a "$(dirname "$0")/app/." /app/
# Installation establishes a fresh disposable baseline; process restarts do not.
database_path="$(realpath -m -- "${DB_PATH:-/app/app.db}")"
case "$database_path" in
  /app/*) ;;
  *) printf '%s\n' 'The disposable application database must be under /app.' >&2; exit 1 ;;
esac
rm -f -- "$database_path" "$database_path-wal" "$database_path-shm"
