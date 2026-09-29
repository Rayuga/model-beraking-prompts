#!/bin/bash
set -euo pipefail

mkdir -p /app
source_app="$(cd -- "$(dirname -- "$0")/app" && pwd -P)"
test -f "$source_app/server.js"
test -f "$source_app/starters/hello.js"

if [[ ! -d /proc/self/fd ]]; then
  printf 'Oracle install: cannot verify that the database is closed; /proc is unavailable.\n' >&2
  exit 1
fi

database_files=(/app/app.db /app/app.db-wal /app/app.db-shm)
shopt -s nullglob
for descriptor in /proc/[0-9]*/fd/[0-9]*; do
  for database_file in "${database_files[@]}"; do
    if [[ -e "$database_file" && "$descriptor" -ef "$database_file" ]]; then
      printf 'Oracle install: %s is open; stop the running application before reinstalling.\n' "$database_file" >&2
      exit 1
    fi
  done
done

rm -f -- "${database_files[@]}"
cp -a "$source_app/." /app/
