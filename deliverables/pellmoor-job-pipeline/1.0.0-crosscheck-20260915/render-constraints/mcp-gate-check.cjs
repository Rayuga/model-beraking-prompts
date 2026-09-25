const {spawn} = require('node:child_process');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Database = require('/usr/local/lib/node_modules/better-sqlite3');
const mcpVersion = require('/usr/local/lib/node_modules/@playwright/mcp/package.json').version;
assert.equal(mcpVersion, '0.0.79');
const app = spawn('node', ['/app/backend/server.js'], {cwd: '/app', stdio: ['ignore', 'pipe', 'pipe']});
const appLog = fs.createWriteStream('/evidence/app.log');
app.stdout.pipe(appLog); app.stderr.pipe(appLog);
let mcp;
let browserStderr = '';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function product() {
  const database = new Database('/app/pellmoor.db', {readonly: true});
  try {
    return Object.fromEntries(['roles', 'candidates', 'panels', 'scores', 'notes', 'activity', 'mutation_receipts'].map(table => [table, database.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()]));
  } finally { database.close(); }
}
async function main() {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch('http://localhost:3000/')).ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert(ready, 'Frozen golden server did not start');
  const before = product();
  fs.writeFileSync('/evidence/product-before.json', JSON.stringify(before, null, 2));
  mcp = spawn('playwright-mcp', ['--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox'], {stdio: ['pipe', 'pipe', 'pipe']});
  const pending = new Map();
  let id = 0, buffer = '';
  mcp.stderr.on('data', data => browserStderr += data);
  mcp.stdout.on('data', data => {
    buffer += data;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      let message; try { message = JSON.parse(line); } catch { continue; }
      if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    }
  });
  async function call(method, params) {
    const current = ++id;
    let timer;
    try {
      return await Promise.race([new Promise(resolve => { pending.set(current, resolve); mcp.stdin.write(JSON.stringify({jsonrpc: '2.0', id: current, method, params}) + '\n'); }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MCP call timed out')), 90000); })]);
    } finally { clearTimeout(timer); }
  }
  await call('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'pellmoor-r8-gate-crosscheck', version: '1.0.0'}});
  mcp.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  const inventory = await call('tools/list', {});
  assert(inventory.result.tools.some(tool => tool.name === 'browser_run_code_unsafe'));
  await call('tools/call', {name: 'browser_navigate', arguments: {url: 'http://localhost:3000'}});
  const response = await call('tools/call', {name: 'browser_run_code_unsafe', arguments: {code: fs.readFileSync('/evidence/gate-workflow.js', 'utf8')}});
  fs.writeFileSync('/evidence/mcp-gate-raw.json', JSON.stringify(response, null, 2));
  assert(!response.error && !response.result?.isError, JSON.stringify(response));
  const text = response.result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  const result = JSON.parse(text.split('### Result\n')[1].split('\n###')[0]);
  const after = product();
  fs.writeFileSync('/evidence/product-after.json', JSON.stringify(after, null, 2));
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  const sourceFiles = ['solution/backend/server.js', 'solution/backend/rules.js', 'solution/src/app.ts', 'solution/public/index.html', 'tests/render/prompt.md', 'tests/render/judge.toml', 'tests/constraints/prompt.md', 'tests/constraints/judge.toml'];
  const report = {scope: 'Fresh actual Playwright MCP browser and authentication crosscheck on the frozen r8 golden app; cached verifier image, not a hosted LLM rescore or exact-image build claim',
    frozen_zip_sha256: 'e2cb22b029d958b29bc817003149236a0b0baa51803982fbee1d69ee171c81af', mcp_version: mcpVersion,
    source_hashes: Object.fromEntries(sourceFiles.map(file => [file, digest(fs.readFileSync('/source/' + file))])),
    ...result, product_state_unchanged: unchanged, product_before_sha256: digest(JSON.stringify(before)), product_after_sha256: digest(JSON.stringify(after)),
    criteria_exercised: ['public_page_loads', 'public_control_responds', 'same_origin_application_shell', 'self_contained_entry_and_reload'], browser_stderr: browserStderr};
  fs.writeFileSync('/evidence/gate-crosscheck.json', JSON.stringify(report, null, 2));
  assert(result.passed, JSON.stringify(result));
  assert(unchanged, 'Authentication smoke mutated hiring product records');
  console.log('PASS ' + result.checks.length + ' actual MCP gate/smoke checkpoints; all four Render/Constraints criteria exercised; hiring product records unchanged');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { mcp?.kill(); app.kill(); });
