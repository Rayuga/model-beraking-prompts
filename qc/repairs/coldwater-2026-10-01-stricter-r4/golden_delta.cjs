'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const {GoldenBrowser, ObservationLedger} = require('/r3drivers/workflow_core.cjs');

const output = '/evidence';
const origin = 'http://localhost:3000';
const mode = process.argv[2];
const report = {scope: 'Scripted golden delta only; no configured judge or provider score', mode, checks: {}};
const record = (name, detail) => { report.checks[name] = {pass: true, ...detail}; };
const readJson = async (request, route) => {
  const response = await request.get(origin + route);
  assert.equal(response.status(), 200, route);
  return response.json();
};
const stateOf = async request => {
  const library = await readJson(request, '/api/snippets');
  const histories = {};
  for (const item of library) histories[item.id] = await readJson(request, '/api/snippets/' + item.id + '/history');
  return {library, histories};
};

async function before(browser) {
  const context = await browser.newContext(), page = await context.newPage();
  const d = new GoldenBrowser(page, new ObservationLedger({mode}), origin);
  await d.open(); await d.disableAutoIfAvailable(); await d.newDraft();
  const marker = 'r4-gate-' + Date.now();
  const nums = [7, 11, 13];
  const source = `const marker=${JSON.stringify(marker)};const values=${JSON.stringify(nums)};let total=0;for(const value of values)total+=value;const button=document.createElement('button');button.textContent='Compute';const result=document.createElement('output');document.body.append(button,result);button.addEventListener('click',()=>{total+=1;result.textContent=marker+':'+total;console.log(result.textContent);});`;
  await d.run(source, 'gate-r4.js');
  for (const offset of [1, 2]) {
    await d.preview().getByRole('button', {name: 'Compute'}).click();
    const expected = marker + ':' + (nums.reduce((a, b) => a + b, 0) + offset);
    assert.equal(await d.preview().locator('output').innerText(), expected);
    assert((await d.logs()).includes(expected));
  }
  record('render_interactive_gate', {marker, source, expectedTotals: [32, 33]});

  const versions = [
    {title: marker + ' A', filename: 'version-a.js', code: "document.body.textContent='history-A-dom'; console.log('history-A');"},
    {title: marker + ' B', filename: 'version-b.html', code: "<html><body><p>history-B-dom</p><script>console.log('history-B');</script></body></html>"},
    {title: marker + ' C', filename: 'version-c.js', code: "document.body.textContent='history-C-dom'; console.log('history-C');"},
  ];
  const saved = [(await d.create(versions[0])).record];
  for (const v of versions.slice(1)) {
    await d.title().fill(v.title); await d.enter(v.code, v.filename);
    saved.push((await d.save()).record);
  }
  const initial = await readJson(page.request, '/api/snippets/' + saved[0].id + '/history');
  assert.equal(initial.length, 3);
  for (let i = 0; i < 3; i++) {
    const observed = initial.find(x => x.revision === saved[i].revision);
    assert(observed);
    assert.equal(observed.code, versions[i].code);
    assert.equal(observed.title, versions[i].title);
  }
  await d.run("document.body.textContent='history-inspection-control-dom';console.log('history-inspection-control');", 'control.js');
  const beforeBody = await d.body(), beforeLogs = await d.logs();
  assert.equal(beforeBody, 'history-inspection-control-dom');
  for (const savedVersion of saved) {
    await page.getByRole('button', {name: 'Revision ' + savedVersion.revision, exact: true}).click();
    assert.equal(await d.body(), beforeBody);
    assert.equal(await d.logs(), beforeLogs);
  }
  record('history_inspection_no_execution', {id: saved[0].id, versions: saved.length, previewUnchanged: true, consoleUnchanged: true});
  const state = await stateOf(page.request);
  assert(state.library.some(x => x.id === saved[0].id));
  fs.writeFileSync(output + '/pre-state.json', JSON.stringify(state, null, 2));
  record('pre_restart_all_records_and_histories', {records: state.library.length, histories: Object.keys(state.histories).length});
  await context.close();
}

async function after(browser) {
  const previous = JSON.parse(fs.readFileSync(output + '/pre-state.json', 'utf8'));
  const context = await browser.newContext();
  const emptyState = await context.storageState();
  assert.deepEqual(emptyState.origins, []);
  const page = await context.newPage();
  await page.goto(origin);
  const actual = await stateOf(page.request);
  assert.deepEqual(actual, previous);
  record('post_restart_clean_context_all_records', {records: actual.library.length, histories: Object.keys(actual.histories).length, storageInitiallyEmpty: true});
  const target = actual.library.find(x => x.title.startsWith('r4-gate-'));
  assert(target);
  const response = await page.request.put(origin + '/api/snippets/' + target.id, {data: {...target, code: target.code + '\n// post restart write'}});
  assert.equal(response.status(), 200);
  const changed = await response.json();
  assert.equal(changed.revision, target.revision + 1);
  await context.close();
  const independent = await browser.newContext();
  assert.deepEqual((await independent.storageState()).origins, []);
  const fresh = await independent.newPage(); await fresh.goto(origin);
  assert.deepEqual(await readJson(fresh.request, '/api/snippets/' + target.id), changed);
  const history = await readJson(fresh.request, '/api/snippets/' + target.id + '/history');
  assert.equal(history.length, previous.histories[target.id].length + 1);
  record('post_restart_write_independent_read', {id: target.id, revision: changed.revision, independentStorageInitiallyEmpty: true});
  await independent.close();
}

async function main() {
  assert(['before', 'after'].includes(mode));
  const browser = await chromium.launch({headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox']});
  try { if (mode === 'before') await before(browser); else await after(browser); }
  finally { await browser.close(); }
  report.passed = Object.values(report.checks).every(x => x.pass);
}
main().catch(error => { report.passed = false; report.error = error.stack; process.exitCode = 1; }).finally(() => {
  fs.writeFileSync(output + '/' + mode + '-delta.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({mode, passed: report.passed, checks: Object.keys(report.checks), error: report.error}));
});
