#!/bin/bash
set -euo pipefail
mkdir -p /app
# Installation establishes a fresh disposable baseline; process restarts do not.
database_path="$(realpath -m -- "${DB_PATH:-/app/app.db}")"
case "$database_path" in
  /app/*) ;;
  *) printf '%s\n' 'The disposable application database must be under /app.' >&2; exit 1 ;;
esac
# Refuse a fresh installation while any process still has this exact SQLite
# database or its journals open. An idle WAL connection also counts as active.
node - "$database_path" <<'JS'
const fs = require('node:fs');
const targets = new Set([process.argv[2], process.argv[2] + '-wal', process.argv[2] + '-shm']);
// A fresh installation has no database to reset and needs no process scan.
if (![...targets].some(target => fs.existsSync(target))) process.exit(0);
for (const pid of fs.readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
  let files;
  try { files = fs.readdirSync(`/proc/${pid}/fd`); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') continue;
    throw new Error(`Cannot verify database inactivity for process ${pid}: ${error.code}`);
  }
  for (const file of files) {
    let target;
    try { target = fs.readlinkSync(`/proc/${pid}/fd/${file}`); }
    catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ESRCH') continue;
      throw error;
    }
    if (targets.has(target)) throw new Error('Refusing installation: the application database is in use. Stop its server first.');
  }
}
JS
cp -a "$(dirname "$0")/app/." /app/
rm -f -- "$database_path" "$database_path-wal" "$database_path-shm"
