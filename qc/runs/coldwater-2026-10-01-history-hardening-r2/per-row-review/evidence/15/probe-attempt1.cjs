const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report = { node: process.version, cwd: process.cwd(), nodePath: process.env.NODE_PATH };
async function main() {
  report.initialApp = fs.readdirSync('/app').sort();
  assert.deepEqual(report.initialApp, ['.git', '.gitkeep']);
  report.gitStatus = cp.execFileSync('git', ['-C', '/app', 'status', '--porcelain'], { encoding: 'utf8' });
  assert.equal(report.gitStatus, '');
  report.staged = {};
  for (const directory of ['/instructions', '/assets']) {
    report.staged[directory] = {};
    for (const name of fs.readdirSync(directory).sort()) {
      const p = directory + '/' + name;
      report.staged[directory][name] = { sha256: hash(p), mode: (fs.statSync(p).mode & 0o777).toString(8) };
      assert.ok(fs.statSync(p).mode & 0o004);
    }
    assert.ok(fs.statSync(directory).mode & 0o005);
  }
  report.dependencies = {};
  for (const [name, version] of [['express', '5.1.0'], ['better-sqlite3', '12.4.1']]) {
    report.dependencies[name] = { version: require(name + '/package.json').version, resolved: require.resolve(name) };
    assert.equal(report.dependencies[name].version, version);
    assert.ok(report.dependencies[name].resolved.startsWith('/usr/local/lib/node_modules/'));
  }
  const Database = require('better-sqlite3');
  let db = new Database('/tmp/row15-native.db');
  db.exec('CREATE TABLE proof (value TEXT)');
  db.prepare('INSERT INTO proof VALUES (?)').run('native binding works');
  db.close();
  db = new Database('/tmp/row15-native.db');
  report.nativeSQLiteReadback = db.prepare('SELECT value FROM proof').get();
  db.close();
  assert.equal(report.nativeSQLiteReadback.value, 'native binding works');
  const missingPathEnv = { ...process.env };
  delete missingPathEnv.NODE_PATH;
  const absentPath = cp.spawnSync('node', ['-e', "require('express'); require('better-sqlite3')"], { cwd: '/app', env: missingPathEnv, encoding: 'utf8' });
  report.negativeControlMissingNodePath = { exit: absentPath.status, moduleNotFound: absentPath.stderr.includes('MODULE_NOT_FOUND') };
  assert.notEqual(absentPath.status, 0);
  assert.ok(report.negativeControlMissingNodePath.moduleNotFound);
  report.solve = cp.spawnSync('bash', ['/solution/solve.sh'], { encoding: 'utf8' });
  report.solve = { status: report.solve.status, stdout: report.solve.stdout, stderr: report.solve.stderr };
  assert.equal(report.solve.status, 0);
  report.installedHashes = {};
  function walk(directory, rel = '') {
    for (const entry of fs.readdirSync(directory + '/' + rel, { withFileTypes: true })) {
      const p = (rel ? rel + '/' : '') + entry.name;
      if (entry.isDirectory()) walk(directory, p);
      else {
        report.installedHashes[p] = hash('/app/' + p);
        assert.equal(report.installedHashes[p], hash('/solution/app/' + p));
      }
    }
  }
  walk('/solution/app');
  report.localNodeModules = fs.existsSync('/app/node_modules');
  assert.equal(report.localNodeModules, false);
  const server = cp.spawn('node', ['/app/server.js'], { cwd: '/tmp', env: { PATH: '/usr/local/bin:/usr/bin:/bin', NODE_PATH: '/usr/local/lib/node_modules', HOME: '/tmp', PORT: '3000', DB_PATH: '/tmp/row15-app.db' }, stdio: ['ignore', 'pipe', 'pipe'] });
  report.server = { stdout: '', stderr: '', cwd: '/tmp', dbPath: '/tmp/row15-app.db' };
  server.stdout.on('data', d => report.server.stdout += d);
  server.stderr.on('data', d => report.server.stderr += d);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const response = await fetch('http://127.0.0.1:3000/api/health');
        report.health = { status: response.status, body: await response.text() };
        if (response.status === 200) { ready = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'application failed to start');
    const ui = await fetch('http://127.0.0.1:3000/');
    const html = await ui.text();
    report.ui = { status: ui.status, bytes: Buffer.byteLength(html), assets: [] };
    assert.equal(ui.status, 200);
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
      const response = await fetch('http://127.0.0.1:3000' + match[1]);
      report.ui.assets.push({ path: match[1], status: response.status, bytes: Buffer.byteLength(await response.text()) });
      assert.equal(response.status, 200);
    }
    assert.ok(report.ui.assets.length >= 2);
    report.applicationDatabaseCreated = fs.existsSync('/tmp/row15-app.db');
    assert.ok(report.applicationDatabaseCreated);
  } finally {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
  }
  report.passed = true;
}
main().then(() => console.log(JSON.stringify(report, null, 2))).catch(error => {
  report.passed = false;
  report.error = String(error.stack || error);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
});
