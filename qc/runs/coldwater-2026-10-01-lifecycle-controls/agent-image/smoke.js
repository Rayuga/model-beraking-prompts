'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const expected = {"/assets/seed_data.json": "f02ce4ff88cffed7f6585f0be3bcc978136278489305e8804cd9a26796dfaa22", "/instructions/behaviour.md": "6c038a576a6d5c32950174ded9a5cba66ba3c84bbe1cdf7feac05a2f0af8a7ce", "/instructions/integration.md": "ef744a4157b4431594fc3a4f8a2c1249b17c2ae77ea1f172ddf579dd418c6e8d", "/instructions/overview.md": "1add8260808b7d06e9a90dc8ae9706fc4e3eb08147cfdcf79df15a15cb7c5a91", "/instructions/policy.md": "680a0c2592fdfe28bd5750a7e00028c26a60b152871ac9ba60d39f50c4499387", "/instructions/security.md": "33e6ff4c65d42e3418dc44d3d4facda58a10d36281ef498bb3a7f2c055fb9d29", "/instructions/ui.md": "18fbb12857f5dccc4253ceec021cf8e412ef3b8751d384dac301ba363af4d8f0"};
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
