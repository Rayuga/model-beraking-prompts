import hashlib
import json
import subprocess
import time
from pathlib import Path

OUT = Path(__file__).resolve().parent
IMAGE = 'hireops-agent:20261001-hard-r2'
inspection = subprocess.run(['docker', 'image', 'inspect', IMAGE], capture_output=True, text=True)
(OUT / 'image-inspect.json').write_text(inspection.stdout, encoding='utf-8')
if inspection.returncode:
    raise RuntimeError(inspection.stderr)
image_id = json.loads(inspection.stdout)[0]['Id']
javascript = r'''
const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const express = require('express');
const Database = require('better-sqlite3');
const database = new Database(':memory:');
database.exec('CREATE TABLE smoke (value INTEGER NOT NULL); INSERT INTO smoke VALUES (42)');
assert.equal(database.prepare('SELECT value FROM smoke').get().value, 42);
database.close();
const assets = {};
for (const path of ['/assets/seed_data.json', '/instructions/integration.md', '/instructions/hireops_rules.md']) {
  fs.accessSync(path, fs.constants.R_OK);
  assets[path] = {sha256: crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'), mode: (fs.statSync(path).mode & 0o777).toString(8)};
}
JSON.parse(fs.readFileSync('/assets/seed_data.json', 'utf8'));
assert.deepEqual(fs.readdirSync('/app').sort(), ['.git', '.gitkeep']);
assert.equal(cp.execFileSync('git', ['-C', '/app', 'rev-parse', '--is-inside-work-tree'], {encoding:'utf8'}).trim(), 'true');
assert.equal(cp.execFileSync('git', ['-C', '/app', 'ls-files'], {encoding:'utf8'}).trim(), '.gitkeep');
assert.equal(require('express/package.json').version, '5.1.0');
assert.equal(require('better-sqlite3/package.json').version, '12.4.1');
assert.equal(process.env.NODE_PATH, '/usr/local/lib/node_modules');
console.log(JSON.stringify({node:process.version, nodePath:process.env.NODE_PATH, cwd:process.cwd(), express:require('express/package.json').version, betterSqlite3:require('better-sqlite3/package.json').version, nativeSqlite:42, appEntries:fs.readdirSync('/app').sort(), assets, sqliteCli:cp.execFileSync('sqlite3',['--version'],{encoding:'utf8'}).trim(), git:cp.execFileSync('git',['--version'],{encoding:'utf8'}).trim()},null,2));
'''
command = ['docker', 'run', '--rm', '--read-only', '--network', 'none', '-i', image_id, 'node', '-']
started = time.monotonic()
result = subprocess.run(command, input=javascript, text=True, capture_output=True, timeout=60)
record = {'image': IMAGE, 'image_id': image_id, 'command': command, 'stdin': javascript, 'exit_code': result.returncode, 'seconds': time.monotonic()-started, 'stdout': result.stdout, 'stderr': result.stderr}
if result.returncode == 0:
    observed = json.loads(result.stdout)
    frozen = Path('.qc-cache/hireops-2026-10-01-transaction-hardening-r2/task/environment')
    record['asset_source_matches'] = {p: hashlib.sha256((frozen / p.lstrip('/')).read_bytes()).hexdigest() == v['sha256'] for p,v in observed['assets'].items()}
    assert all(record['asset_source_matches'].values())
(OUT / 'runtime-probe.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,indent=2))
raise SystemExit(result.returncode)
