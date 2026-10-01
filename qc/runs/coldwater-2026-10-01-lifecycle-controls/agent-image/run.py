import hashlib
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
CONTEXT = ROOT / '.qc-cache/coldwater-2026-10-01-lifecycle-controls/task/environment'
INPUT = '6a1e1645d3f5518ba2b935fdb339053a96ae6cbfbaeb48546616d752f3133ca2'
TAG = 'coldwater-lifecycle-control:6a1e1645d3f5'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

sources = {p.relative_to(ROOT).as_posix(): sha(p) for p in sorted(CONTEXT.rglob('*')) if p.is_file()}
expected = {'/' + p.relative_to(CONTEXT).as_posix(): sha(p) for p in sorted(CONTEXT.rglob('*')) if p.is_file() and p.name != 'Dockerfile'}
binding = {'input_sha256': INPUT, 'context': str(CONTEXT), 'source_sha256': sources, 'tag': TAG}
(OUT / 'source-binding.json').write_text(json.dumps(binding, indent=2) + '\n', encoding='utf-8')

def run(name, args, timeout, stdin=None):
    started = time.time()
    (OUT / (name + '-command.json')).write_text(json.dumps({'argv': args, 'timeout_sec': timeout, 'input_sha256': INPUT}, indent=2) + '\n', encoding='utf-8')
    result = subprocess.run(args, input=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    (OUT / (name + '-stdout.log')).write_bytes(result.stdout)
    (OUT / (name + '-stderr.log')).write_bytes(result.stderr)
    record = {'argv': args, 'exit_code': result.returncode, 'wall_seconds': time.time() - started}
    print(json.dumps({'step': name, **record}), flush=True)
    if result.returncode:
        print(result.stderr.decode('utf-8', errors='replace')[-4000:], flush=True)
        raise RuntimeError(name + ' failed')
    return result, record

build, build_record = run('build', ['docker', 'build', '--progress=plain', '--tag', TAG, str(CONTEXT)], 600)
inspect, inspect_record = run('image-inspect', ['docker', 'image', 'inspect', TAG], 60)
image = json.loads(inspect.stdout)[0]
image_id = image['Id']
script = """'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const expected = EXPECTED_REPLACE;
assert.equal(process.env.NODE_PATH, '/usr/local/lib/node_modules');
assert.equal(process.cwd(), '/app');
assert.equal(process.getuid(), 65534);
const actual = {};
function scan(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = dir + '/' + entry.name;
    assert(!entry.isSymbolicLink(), p + ': unexpected symlink');
    if (entry.isDirectory()) scan(p);
    else {
      fs.accessSync(p, fs.constants.R_OK);
      actual[p] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  }
}
scan('/instructions'); scan('/assets');
assert.deepEqual(actual, expected);
JSON.parse(fs.readFileSync('/assets/seed_data.json', 'utf8'));
assert.deepEqual(fs.readdirSync('/app').sort(), ['.git','.gitkeep']);
assert.equal(fs.statSync('/app/.gitkeep').size, 0);
for (const forbidden of ['/tests','/solution']) assert(!fs.existsSync(forbidden), forbidden + ' leaked');
const git = (...args) => cp.execFileSync('git', ['-c','safe.directory=/app','-C','/app',...args], {encoding:'utf8'}).trim();
assert.equal(git('status','--porcelain'), '');
assert.equal(git('ls-files'), '.gitkeep');
assert.equal(git('log','-1','--format=%s'), 'Initialize task workspace');
const express = require('express');
const Database = require('better-sqlite3');
assert.equal(require('express/package.json').version, '5.1.0');
assert.equal(require('better-sqlite3/package.json').version, '12.4.1');
const db = new Database(':memory:');
db.exec('CREATE TABLE witness (value TEXT NOT NULL)');
db.prepare('INSERT INTO witness VALUES (?)').run('row15');
assert.equal(db.prepare('SELECT value FROM witness').get().value, 'row15');
db.close();
const app = express();
app.get('/probe', (_req,res) => res.json({ok:true}));
const server = app.listen(0, '127.0.0.1', async () => {
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/probe');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok:true});
    console.log(JSON.stringify({ok:true, uid:process.getuid(), node:process.version, express:require('express/package.json').version, better_sqlite3:require('better-sqlite3/package.json').version, sqlite_native_query:true, express_http:true, no_network:true, staged_sha256:actual, empty_app:true, git_clean:true, forbidden_roots_absent:true}));
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); }
});
""".replace('EXPECTED_REPLACE', json.dumps(expected))
(OUT / 'smoke.js').write_text(script, encoding='utf-8')
smoke, smoke_record = run('smoke', ['docker', 'run', '--pull', 'never', '--rm', '--network', 'none', '--user', '65534:65534', '--entrypoint', 'node', '-i', image_id], 60, script.encode('utf-8'))
observation = json.loads(smoke.stdout)
assert all(sha(ROOT / p) == h for p, h in sources.items()), 'Source changed during measurement'
results = {'input_sha256': INPUT, 'image_id': image_id, 'build': build_record, 'smoke': smoke_record, 'observation': observation, 'source_unchanged': True, 'scope': 'Agent-image build and no-network smoke only; no configured judge or Oracle was run.'}
(OUT / 'RESULTS.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
artifact_hashes = {p.relative_to(ROOT).as_posix(): sha(p) for p in sorted(OUT.iterdir()) if p.is_file() and p.name != 'artifact-hashes.json'}
(OUT / 'artifact-hashes.json').write_text(json.dumps(artifact_hashes, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'ok': True, 'image_id': image_id, 'observation': observation}), flush=True)
