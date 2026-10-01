#!/bin/bash
set -euo pipefail

mkdir -p /app
source_app="$(cd -- "$(dirname -- "$0")/app" && pwd -P)"
test -f "$source_app/server.js"

node <<'NODE'
const fs = require('node:fs');
const databaseFiles = ['/app/app.db', '/app/app.db-wal', '/app/app.db-shm'];
const gone = error => error.code === 'ENOENT' || error.code === 'ESRCH';
try {
  const databases = databaseFiles.flatMap(path => {
    try { return [{ path, stat: fs.statSync(path, { bigint: true }) }]; }
    catch (error) { if (gone(error)) return []; throw error; }
  });
  if (databases.length) {
    for (const pid of fs.readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
      let descriptors;
      try { descriptors = fs.readdirSync(`/proc/${pid}/fd`); }
      catch (error) { if (gone(error)) continue; throw error; }
      for (const descriptor of descriptors) {
        let stat;
        try { stat = fs.statSync(`/proc/${pid}/fd/${descriptor}`, { bigint: true }); }
        catch (error) { if (gone(error)) continue; throw error; }
        const open = databases.find(database => database.stat.dev === stat.dev && database.stat.ino === stat.ino);
        if (open) throw new Error(`${open.path} is open; stop the running application before reinstalling.`);
      }
    }
  }
} catch (error) {
  console.error(`Oracle install: cannot safely reset the database: ${error.message}`);
  process.exit(1);
}
NODE

rm -f -- /app/app.db /app/app.db-wal /app/app.db-shm
cp -a "$source_app/." /app/
