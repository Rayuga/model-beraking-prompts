const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const Database = require('better-sqlite3');
const base = 'http://127.0.0.1:3000';
const results = [];
let child = null;
const appLog = fs.openSync('/evidence/reinstall-app.log', 'w');
const seed = JSON.parse(fs.readFileSync('/solution/app/seed_data.json', 'utf8'));
const address = { name: 'Oracle Install Check', line1: '14 Paper Lane', line2: '', city: 'Bristol', postcode: 'BS1 4QA', country: 'United Kingdom' };

function install() {
  return execFileSync('bash', ['/solution/solve.sh'], { encoding: 'utf8', stdio: 'pipe', timeout: 20000 });
}
async function request(path, body) {
  const response = await fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function start() {
  child = spawn(process.execPath, ['/app/server.js'], { cwd: '/app', env: { ...process.env, DB_PATH: '/app/app.db', PORT: '3000' }, stdio: ['ignore', appLog, appLog] });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error('Golden server exited during startup.');
    try { const health = await request('/api/health'); if (health.status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Golden server did not become ready.');
}
async function stop() {
  if (!child) return;
  const running = child;
  child = null;
  if (running.exitCode !== null) return;
  const exited = new Promise(resolve => running.once('exit', resolve));
  running.kill('SIGTERM');
  await exited;
}
function databaseSnapshot() {
  const db = new Database('/app/app.db', { readonly: true });
  try {
    return {
      variants: db.prepare('SELECT sku,size,in_stock FROM variants ORDER BY sku,size').all(),
      orders: db.prepare('SELECT reference,status,checkout_id,total_pence FROM orders ORDER BY reference').all(),
      lines: db.prepare('SELECT order_reference,sku,size,qty,unit_price_pence FROM order_lines ORDER BY order_reference,sku,size').all(),
      meta: db.prepare('SELECT k,v FROM meta ORDER BY k').all()
    };
  } finally { db.close(); }
}
function stock(snapshot, sku, size) { return snapshot.variants.find(variant => variant.sku === sku && variant.size === size).in_stock; }
async function catalogueMatchesSeed() {
  const catalogue = await request('/api/prints');
  assert.equal(catalogue.status, 200);
  assert.equal(catalogue.body.prints.length, 8);
  const actual = catalogue.body.prints.flatMap(print => print.sizes).map(variant => ({ sku: variant.sku, size: variant.size, in_stock: variant.in_stock })).sort((a, b) => `${a.sku}:${a.size}`.localeCompare(`${b.sku}:${b.size}`));
  const expected = seed.variants.map(variant => ({ sku: variant.sku, size: variant.size, in_stock: variant.in_stock })).sort((a, b) => `${a.sku}:${a.size}`.localeCompare(`${b.sku}:${b.size}`));
  assert.equal(actual.length, 13);
  assert.deepEqual(actual, expected);
}
async function purchase(lines, identity = crypto.randomUUID()) {
  const body = { lines, address, checkout_id: identity };
  const response = await request('/api/orders', body);
  assert.equal(response.status, 201);
  return { request: body, order: response.body };
}
async function main() {
  try {
    execFileSync('bash', ['-n', '/solution/solve.sh']);
    fs.mkdirSync('/app', { recursive: true });
    fs.writeFileSync('/app/install-sentinel.txt', 'keep this unrelated file');
    fs.writeFileSync('/app/unrelated.db', 'not the golden database');
    install();
    await start();
    await catalogueMatchesSeed();
    const initial = databaseSnapshot();
    assert.equal(initial.orders.length, 1);
    assert.equal(initial.orders[0].reference, 'RP-100001');
    const historic = await request('/api/orders/RP-100001');
    assert.equal(historic.body.status, 'dispatched');
    assert.equal(historic.body.total_pence, 7320);
    assert.equal(historic.body.lines[0].qty, 2);
    assert.equal(historic.body.lines[0].unit_price_pence, 3500);
    results.push({ check: 'fresh_install_seeds_exact_catalogue_and_historical_receipt', result: 'pass', prints: 8, variants: 13, orders: 1 });

    const soldOut = await purchase([{ sku: 'RP-104', size: 'A2', qty: 1 }]);
    const second = await purchase([{ sku: 'RP-101', size: 'A3', qty: 2 }]);
    const used = databaseSnapshot();
    assert.equal(stock(used, 'RP-104', 'A2'), 0);
    assert.equal(stock(used, 'RP-101', 'A3'), 10);
    assert.equal(used.orders.length, 3);
    results.push({ check: 'real_checkouts_deplete_stock_and_create_orders', result: 'pass', references: [soldOut.order.reference, second.order.reference] });

    let refused;
    try { install(); } catch (error) { refused = error; }
    assert(refused, 'Reinstall must refuse while the old server holds the database open.');
    assert.equal(refused.status, 1);
    assert.match(String(refused.stderr), /is open; stop the running application/);
    assert.deepEqual(databaseSnapshot(), used);
    assert.equal((await request('/api/health')).status, 200);
    results.push({ check: 'active_database_reinstall_refused_without_mutation_or_process_kill', result: 'pass', message: String(refused.stderr).trim() });

    await stop();
    await start();
    assert.deepEqual(databaseSnapshot(), used);
    assert.equal((await request('/api/orders/' + soldOut.order.reference)).body.reference, soldOut.order.reference);
    const retried = await request('/api/orders', soldOut.request);
    assert.equal(retried.status, 200);
    assert.equal(retried.body.reference, soldOut.order.reference);
    assert.deepEqual(databaseSnapshot(), used);
    results.push({ check: 'ordinary_runtime_restart_keeps_orders_stock_and_retry_identity', result: 'pass' });

    await stop();
    const beforeInstallFiles = ['/app/app.db', '/app/app.db-wal', '/app/app.db-shm'].map(file => ({ file, existed: fs.existsSync(file) }));
    install();
    for (const file of ['/app/app.db', '/app/app.db-wal', '/app/app.db-shm']) assert.equal(fs.existsSync(file), false);
    assert.equal(fs.readFileSync('/app/install-sentinel.txt', 'utf8'), 'keep this unrelated file');
    assert.equal(fs.readFileSync('/app/unrelated.db', 'utf8'), 'not the golden database');
    results.push({ check: 'stopped_reinstall_removes_only_canonical_database_and_sidecars', result: 'pass', beforeInstallFiles });
    await start();
    await catalogueMatchesSeed();
    assert.deepEqual(databaseSnapshot(), initial);
    assert.equal((await request('/api/orders/' + soldOut.order.reference)).status, 404);
    assert.equal((await request('/api/orders/' + second.order.reference)).status, 404);
    assert.deepEqual((await request('/api/orders/RP-100001')).body, historic.body);
    results.push({ check: 'reinstall_restores_all_seed_stock_historic_receipt_and_no_prior_order', result: 'pass', prints: 8, variants: 13, orders: 1 });

    const newOrder = await purchase([{ sku: 'RP-101', size: 'A3', qty: 1 }]);
    const newState = databaseSnapshot();
    assert.equal(stock(newState, 'RP-101', 'A3'), 11);
    await stop();
    await start();
    assert.deepEqual(databaseSnapshot(), newState);
    assert.equal((await request('/api/orders/' + newOrder.order.reference)).body.reference, newOrder.order.reference);
    const newRetry = await request('/api/orders', newOrder.request);
    assert.equal(newRetry.status, 200);
    assert.equal(newRetry.body.reference, newOrder.order.reference);
    assert.deepEqual(databaseSnapshot(), newState);
    results.push({ check: 'post_reinstall_runtime_restart_preserves_new_writes_and_retry_identity', result: 'pass', reference: newOrder.order.reference });

    fs.writeFileSync('/evidence/oracle-reinstall-results.json', JSON.stringify({ result: 'pass', checks: results.length, results }, null, 2));
    console.log(JSON.stringify({ result: 'pass', checks: results.length, results }, null, 2));
  } catch (error) {
    fs.writeFileSync('/evidence/oracle-reinstall-results.json', JSON.stringify({ result: 'fail', results, error: error.stack }, null, 2));
    throw error;
  } finally { await stop(); fs.closeSync(appLog); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
