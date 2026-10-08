'use strict';
// Local MCP feasibility evidence. No provider or configured verifier is invoked.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = '/work';
const out = path.resolve(process.argv[2] || path.join(root, 'qc/runs/hireops-2026-09-30-development/mcp', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(out, { recursive: true });
const port = Number(process.env.HIREOPS_MCP_PORT || 3032), base = `http://127.0.0.1:${port}`;
const app = path.join(root, 'projects/hireops-recruiting-operations/hireops-recruiting-operations/solution/app/server.js');
const cli = path.join(root, '.tools/hireops/node_modules/@playwright/mcp/cli.js');
const executable = process.env.HIREOPS_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = [cli, '--headless', '--isolated', '--no-sandbox', '--executable-path', executable, '--output-dir', out];
const results = [], pending = new Map();
const startedAt = new Date().toISOString(), startedMs = Date.now();
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function sourceHashes(dir = path.dirname(app)) {
  const files = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, sourceHashes(file));
    else files[path.relative(root, file).replace(/\\/g, '/')] = sha256(file);
  }
  return files;
}
const sourceBefore = sourceHashes();
let serial = 0, mcp;
const appServer = spawn(process.execPath, [app], { cwd: out, windowsHide: true, env: { ...process.env, NODE_PATH: path.join(root, '.tools/hireops/node_modules'), PORT: String(port), DB_PATH: path.join(out, 'mcp.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverLog = fs.createWriteStream(path.join(out, 'server.log'));
appServer.stdout.pipe(serverLog); appServer.stderr.pipe(serverLog);
function log(name, obj) { fs.appendFileSync(path.join(out, name), JSON.stringify(obj) + '\n'); }
function rpc(method, params) {
  const id = ++serial;
  const msg = { jsonrpc: '2.0', id, method, params };
  log('requests.jsonl', msg);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`RPC timeout: ${method}`)); }, 55000);
    pending.set(id, { resolve: x => { clearTimeout(timer); resolve(x); }, reject });
    mcp.stdin.write(JSON.stringify(msg) + '\n');
  });
}
async function tool(name, arguments_) {
  const reply = await rpc('tools/call', { name, arguments: arguments_ });
  if (reply.error || reply.result?.isError) throw new Error(JSON.stringify(reply));
  return reply.result;
}
async function run(name, code) {
  const result = await tool('browser_run_code_unsafe', { code });
  results.push({ name, passed: true, result });
  console.log('PASS', name);
  return result;
}
async function main() {
  for (let n = 0; n < 100; n++) {
    try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
    if (appServer.exitCode !== null) throw new Error('App server exited early');
    await new Promise(r => setTimeout(r, 100));
  }
  mcp = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  mcp.stderr.pipe(fs.createWriteStream(path.join(out, 'mcp-stderr.log')));
  readline.createInterface({ input: mcp.stdout }).on('line', line => {
    try {
      const msg = JSON.parse(line); log('responses.jsonl', msg);
      if (pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); p.resolve(msg); }
    } catch { log('non-json-output.jsonl', line); }
  });
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'hireops-local-feasibility', version: '1.0' } });
  mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const list = await rpc('tools/list', {});
  fs.writeFileSync(path.join(out, 'tools.json'), JSON.stringify(list, null, 2));
  const names = list.result.tools.map(t => t.name);
  assert(names.includes('browser_run_code_unsafe'));
  assert(!names.includes('browser_run_code'));
  assert(!names.includes('browser_run'));
  results.push({ name: 'real tools/list names', passed: true, names });
  console.log('Tools:', names.join(', '));
  await tool('browser_navigate', { url: base });
  await run('UI login and arbitrary-ID durable creation', `async (page) => {
    await page.locator('#email').fill('rafael.costa@hireops.example');
    await page.locator('#password').fill('Hireops!2026');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:'Coordinated Changes',exact:true}).waitFor();
    await page.getByRole('navigation').getByRole('button',{name:'Requisitions',exact:true}).click();
    await page.locator('#req-id').fill(' MCP / ? # readback ');
    await page.locator('#req-title').fill('MCP isolated-context record');
    await page.locator('#req-budget').fill('50000.01');
    await page.getByRole('button',{name:'Create requisition',exact:true}).click();
    await page.locator('article.entity').filter({hasText:'MCP isolated-context record'}).waitFor();
    return {created:true};
  }`);
  await run('browser newContext, separate UI sign-in and stored readback', `async (page) => {
    const fresh = await page.context().browser().newContext();
    try {
      const tab = await fresh.newPage(); await tab.goto(${JSON.stringify(base)});
      await tab.locator('#email').fill('aud.halvorsen@hireops.example');
      await tab.locator('#password').fill('Hireops!2026');
      await tab.getByRole('button',{name:'Sign in',exact:true}).click();
      await tab.getByRole('heading',{name:'Coordinated Changes',exact:true}).waitFor();
      await tab.getByRole('navigation').getByRole('button',{name:'Requisitions',exact:true}).click();
      const text = await tab.locator('article.entity').filter({hasText:'MCP isolated-context record'}).innerText();
      if (!text.includes('$50,000.01')) throw new Error('Saved cents missing in independent context');
      return {freshContext:true,separateUiLogin:true,visibleRecord:text};
    } finally { await fresh.close(); }
  }`);
  await run('ordinary response hold and release around browser UI creation', `async (page) => {
    let release, seen;
    const held = new Promise(resolve => { release = resolve; });
    const arrived = new Promise(resolve => { seen = resolve; });
    const handler = async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      seen(response.status()); await held; await route.fulfill({response});
    };
    await page.route('**/api/requisitions', handler);
    try {
      await page.locator('#req-id').fill('MCP-delayed');
      await page.locator('#req-title').fill('MCP delayed response record');
      await page.locator('#req-budget').fill('1.23');
      await page.getByRole('button',{name:'Create requisition',exact:true}).click();
      const status = await arrived;
      const beforeRelease = await page.locator('article.entity').filter({hasText:'MCP delayed response record'}).count();
      release();
      await page.locator('article.entity').filter({hasText:'MCP delayed response record'}).waitFor();
      return {realResponseStatus:status,visibleBeforeRelease:beforeRelease,visibleAfterRelease:true};
    } finally { release(); await page.unroute('**/api/requisitions', handler); }
  }`);
  await run('Promise.all browser APIRequestContext requests with session authority', `async (page) => {
    const responses = await Promise.all([
      page.context().request.get(${JSON.stringify(base + '/api/requisitions/' + encodeURIComponent(' MCP / ? # readback '))}),
      page.context().request.get(${JSON.stringify(base + '/api/requisitions/MCP-delayed')})
    ]);
    const rows = await Promise.all(responses.map(async r => ({status:r.status(),body:await r.json()})));
    if (rows.some(r => r.status !== 200)) throw new Error('Parallel session requests failed');
    return rows.map(r => ({status:r.status,id:r.body.id,budget_cents:r.body.budget_cents}));
  }`);
  await run('Promise.all overlapping POSTs through browser request context', `async (page) => {
    const responses = await Promise.all(['A','B'].map(suffix => page.context().request.post(${JSON.stringify(base + '/api/requisitions')}, {
      data:{id:'MCP-parallel-' + suffix,title:'MCP parallel ' + suffix,dept:'Research',budget_cents:123}
    })));
    const rows = await Promise.all(responses.map(async r => ({status:r.status(),body:await r.json()})));
    if (rows.some(r => r.status !== 200 || r.body.created !== true)) throw new Error('Parallel session POSTs failed');
    return rows.map(r => ({status:r.status,id:r.body.id,budget_cents:r.body.budget_cents}));
  }`);
  await run('forward real operation then lose response, preserve page, retry mechanism available', `async (page) => {
    let forwarded=0, realStatus;
    const handler=async route=>{ if(route.request().method()!=='POST')return route.continue(); const response=await route.fetch(); forwarded++;realStatus=response.status();await route.abort('failed'); };
    await page.route('**/api/requisitions',handler);
    try {
      await page.locator('#req-id').fill('MCP-lost-response');await page.locator('#req-title').fill('MCP response loss');
      await page.getByRole('button',{name:'Create requisition',exact:true}).click();await page.locator('#flash .error').waitFor();
    } finally {await page.unroute('**/api/requisitions',handler);}
    const response=await page.context().request.get('${base}/api/requisitions/MCP-lost-response');
    if(forwarded!==1||realStatus!==200||response.status()!==200)throw new Error('Response-loss mechanism did not forward exactly one real successful operation');
    return {forwarded,realStatus,browserObservedFailure:true,persistedDespiteLostResponse:true};
  }`);
  await tool('browser_close', {});
}
main().catch(e => { results.push({ name: 'failure', passed: false, error: e.stack }); console.error(e.message); process.exitCode = 1; }).finally(() => {
  const sourceAfter = sourceHashes();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ evidenceKind: 'local stdio MCP tool feasibility, not full configured judge', startedAt, endedAt: new Date().toISOString(), durationMs: Date.now() - startedMs, scriptSha256: sha256(__filename), sourceBefore, sourceAfter, sourceUnchanged: JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter), command: [process.execPath, __filename], node: process.version, packageVersion: require(path.join(root, '.tools/hireops/node_modules/@playwright/mcp/package.json')).version, mcpCommand: [process.execPath, ...args], localVariation: 'None: pinned Linux Chromium executable and MCP flags', results }, null, 2));
  if (mcp) mcp.kill(); appServer.kill();
  for (const p of pending.values()) p.resolve({ error: { message: 'client closing' } }); pending.clear();
  console.log('Evidence:', out);
});
