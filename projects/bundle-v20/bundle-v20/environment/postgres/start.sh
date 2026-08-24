#!/bin/bash
# Start the shop Postgres cluster shipped in the image.
set -euo pipefail
if pg_isready -h 127.0.0.1 -p 5432 -q; then
  echo "[postgres] already accepting connections"
else
  if command -v pg_ctlcluster >/dev/null 2>&1; then
    pg_ctlcluster 16 main start || true
  fi
  if command -v service >/dev/null 2>&1; then
    service postgresql start || true
  fi
fi

deadline=$((SECONDS + 30))
until pg_isready -h 127.0.0.1 -p 5432 -q; do
  if (( SECONDS >= deadline )); then
    echo "[postgres] did not become ready" >&2
    exit 1
  fi
  sleep 0.4
done

su -s /bin/bash postgres -c "psql -v ON_ERROR_STOP=1 -tc \"SELECT 1 FROM pg_roles WHERE rolname='gearvault'\"" | grep -q 1 \
  || su -s /bin/bash postgres -c "psql -v ON_ERROR_STOP=1 -c \"CREATE USER gearvault WITH PASSWORD 'gearvault';\""
su -s /bin/bash postgres -c "psql -v ON_ERROR_STOP=1 -tc \"SELECT 1 FROM pg_database WHERE datname='gearvault'\"" | grep -q 1 \
  || su -s /bin/bash postgres -c "psql -v ON_ERROR_STOP=1 -c \"CREATE DATABASE gearvault OWNER gearvault;\""
su -s /bin/bash postgres -c "psql -v ON_ERROR_STOP=1 -d gearvault -c \"CREATE EXTENSION IF NOT EXISTS btree_gist;\""
echo "[postgres] ready"
