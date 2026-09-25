import json
import sqlite3
from pathlib import Path

config = json.loads(Path('/logs/verifier/app-lifecycle.json').read_text())
path = Path(config['database']).resolve()
if not path.is_file() or path.open('rb').read(16) != b'SQLite format 3\x00':
    raise SystemExit('Declared database is not SQLite')
db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
db.row_factory = sqlite3.Row
out = {'path': str(path), 'integrity': db.execute('PRAGMA integrity_check').fetchone()[0], 'tables': {}}
for name, sql in db.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
    quoted = '"' + name.replace('"', '""') + '"'
    rows = [dict(row) for row in db.execute('SELECT * FROM ' + quoted + ' LIMIT 500')]
    for row in rows:
        for key in row:
            if any(word in key.lower() for word in ('password','token','secret','cookie','credential','hash')):
                row[key] = '[redacted]'
    out['tables'][name] = {'schema': sql, 'count': db.execute('SELECT COUNT(*) FROM ' + quoted).fetchone()[0], 'rows': rows}
print(json.dumps(out, indent=2))
