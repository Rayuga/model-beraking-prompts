const fs = require('node:fs');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const base = 'http://127.0.0.1:3000';
const results = { started_at: new Date().toISOString(), checks: [] };
const log = fs.openSync('/work/reinstall-app.log', 'w');
let child;
function install() { return execFileSync('bash', ['/solution/solve.sh'], { encoding: 'utf8', stdio: 'pipe', timeout: 20000 }); }
function pass(name) { results.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function request(url, method = 'GET', body) {
  const response = await fetch(base + url, { method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function start() {
  child = spawn(process.execPath, ['/app/server.js'], { cwd: '/app', env: { ...process.env, DB_PATH: '/app/app.db', PORT: '3000' }, stdio: ['ignore', log, log] });
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error('Golden exited during startup');
    try { if ((await request('/api/snippets')).status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Golden did not start');
}
async function stop() {
  if (!child) return;
  const owned = child; child = null;
  if (owned.exitCode !== null) return;
  const stopped = new Promise(resolve => owned.once('exit', resolve));
  owned.kill('SIGTERM'); await stopped;
}
async function create(title, code) {
  const response = await request('/api/snippets', 'POST', { title, filename: 'probe.js', code });
  assert.equal(response.status, 201); return response.body;
}
async function main() {
  execFileSync('bash', ['-n', '/solution/solve.sh']);
  fs.mkdirSync('/app', { recursive: true });
  fs.writeFileSync('/app/install-sentinel.txt', 'unrelated file survives');
  fs.writeFileSync('/app/unrelated.db', 'not the golden database');
  install(); await start();
  assert.deepEqual((await request('/api/snippets')).body, []);
  pass('fresh golden installation starts with the intended empty saved library');
  const first = await create('Before reinstall', "console.log('saved-before-reinstall');");
  const second = await create('Independent second snippet', '<p>other saved content</p>');
  const changed = await request('/api/snippets/' + first.id, 'PUT', { ...first, title: 'Before reinstall revised', code: "console.log('revision-two');" });
  assert.equal(changed.status, 200); assert.equal(changed.body.revision, 2);
  const saved = (await request('/api/snippets')).body;
  pass('real records and revised source written through application API');
  let refusal;
  try { install(); } catch (error) { refusal = { status: error.status, stderr: String(error.stderr) }; }
  assert.equal(refusal?.status, 1);
  assert.match(refusal.stderr, /is open; stop the running application/);
  assert.equal(child.exitCode, null);
  assert.deepEqual((await request('/api/snippets')).body, saved);
  results.active_refusal = refusal;
  pass('active reinstall refuses safely, keeps server alive and preserves all saved records');
  await stop(); await start();
  assert.deepEqual((await request('/api/snippets')).body, saved);
  assert.deepEqual((await request('/api/snippets/' + first.id)).body, changed.body);
  pass('ordinary process restart preserves exact source, titles and revisions');
  await stop();
  results.canonical_files_before_reset = ['/app/app.db', '/app/app.db-wal', '/app/app.db-shm'].filter(file => fs.existsSync(file));
  assert.ok(results.canonical_files_before_reset.includes('/app/app.db'));
  install();
  for (const file of ['/app/app.db', '/app/app.db-wal', '/app/app.db-shm']) assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync('/app/install-sentinel.txt', 'utf8'), 'unrelated file survives');
  assert.equal(fs.readFileSync('/app/unrelated.db', 'utf8'), 'not the golden database');
  await start();
  assert.deepEqual((await request('/api/snippets')).body, []);
  assert.equal((await request('/api/snippets/' + first.id)).status, 404);
  assert.equal((await request('/api/snippets/' + second.id)).status, 404);
  pass('stopped reinstall removes only canonical database/sidecars and restores fresh library');
  const fresh = await create('After reinstall', "console.log('fresh-persistence');");
  await stop(); await start();
  assert.deepEqual((await request('/api/snippets')).body, [fresh]);
  assert.deepEqual((await request('/api/snippets/' + fresh.id)).body, fresh);
  pass('new post-install writes remain durable across another normal process restart');
  results.passed = true;
}
main().catch(error => { results.passed = false; results.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => { await stop(); results.finished_at = new Date().toISOString(); fs.writeFileSync('/work/oracle-reinstall-results.json', JSON.stringify(results, null, 2)); fs.closeSync(log); });
