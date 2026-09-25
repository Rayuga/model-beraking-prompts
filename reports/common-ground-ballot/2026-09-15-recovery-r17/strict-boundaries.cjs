/* Local authoring regression only. This file is not part of the uploaded task.
 * Run against a fresh, already-running app with STRICT_APP=golden|gpt.
 * Every HTTP mutation is adapted from an actual successful visible UI exchange.
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

const app = process.env.STRICT_APP || 'golden';
if (!['golden', 'gpt'].includes(app)) throw new Error('STRICT_APP must be golden or gpt');
const base = process.env.STRICT_URL || 'http://localhost:3000';
const output = '/results/strict-boundaries-results.json';
const checks = [], errors = [], reads = new Map(), pendingReads = new Set(), memberContexts = new Map();
const runId = crypto.randomBytes(3).toString('hex');
let browser, context, page, number = 0;
let phase = 'initializing';
async function bounded(label, promise, timeout = 15000) {
  phase = label; console.log(`STEP ${label}`);
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Driver wait exceeded ${timeout}ms: ${label}`)), timeout);
  })]); } finally { clearTimeout(timer); }
}
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
const equal = (a, b) => canonical(a) === canonical(b);
const fresh = () => crypto.randomUUID();
const title = label => `Strict ${runId} ${++number} ${label}`;
const isWrite = request => !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
const isOperation = request => {
  try { return Object.keys(request.postDataJSON() || {}).some(key => /^operation_?id$/i.test(key)); }
  catch { return false; }
};
function save() {
  fs.mkdirSync('/results', { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ app, runId, phase, checks, passed: checks.filter(c => c.passed).length,
    failed: checks.filter(c => !c.passed).length, errors, finishedAt: new Date().toISOString() }, null, 2), 'utf8');
}
function record(name, passed, evidence = {}) {
  checks.push({ name, passed: Boolean(passed), ...evidence });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  save();
}
async function independent(name, action) {
  try { await action(); }
  catch (error) {
    errors.push({ stage: name, message: error.message, stack: error.stack });
    record(`${name}: executable setup`, false, { driverError: error.message });
    await page.screenshot({ path: `/results/strict-error-${errors.length}.png`, fullPage: true }).catch(() => {});
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  }
}
function observedBusiness(body) {
  if (body && body.views) return { ballots: body.views.ballots, members: body.views.members, audit: body.views.audit };
  if (body && Array.isArray(body.ballots)) return { ballots: body.ballots };
  if (body && Array.isArray(body.members)) return { members: body.members };
  if (body && Array.isArray(body.events)) return { events: body.events };
  return null;
}
async function settleReads() { await bounded('settle observed JSON reads', Promise.allSettled([...pendingReads]), 10000); }
async function nav(name) {
  await bounded(`navigate ${name}`, page.locator('nav').getByRole('button', { name, exact: true }).click());
  await bounded(`navigation ${name} network idle`, page.waitForLoadState('networkidle'));
  await settleReads();
}
async function reload() { await bounded('reload', page.reload({ waitUntil: 'networkidle' })); await settleReads(); }
async function snapshot() {
  await settleReads();
  const result = {};
  for (const [url, observed] of reads) {
    const response = await bounded(`protected snapshot ${url}`, context.request.fetch(url, { method: observed.method, headers: observed.headers, timeout: 15000 }));
    if (!response.ok()) throw new Error(`Observed protected read failed: ${response.status()} ${url}`);
    const data = observedBusiness(await bounded(`snapshot JSON ${url}`, response.json()));
    if (!data) throw new Error(`Observed protected read lost its business collection: ${url}`);
    result[url] = data;
  }
  if (!Object.keys(result).length) throw new Error('No genuine protected business read captured');
  return result;
}
function membersFrom(state) {
  for (const value of Object.values(state)) {
    if (Array.isArray(value.members)) return value.members;
    if (value.members && Array.isArray(value.members.roster)) return value.members.roster;
  }
  throw new Error('No observed membership collection');
}
async function memberNow() {
  const member = membersFrom(await snapshot()).find(item => item.name === 'Owen Park');
  if (!member) throw new Error('Owen not present in observed roster');
  return member;
}
async function uiWrite(action) {
  const responsePromise = page.waitForResponse(response => isWrite(response.request()) && isOperation(response.request()), { timeout: 20000 })
    .then(response => ({ response }), error => ({ error }));
  await bounded('visible staff action', action());
  const capture = await responsePromise;
  if (capture.error) throw capture.error;
  const response = capture.response;
  const request = response.request();
  const body = await bounded('visible action response JSON', response.json());
  const exchange = { request: { url: request.url(), method: request.method(), body: request.postDataJSON(),
    headers: { 'content-type': request.headers()['content-type'] || 'application/json' } }, status: response.status(), body };
  if (!response.ok()) throw new Error(`Ordinary UI write refused ${response.status()}: ${JSON.stringify(body)}`);
  await bounded('visible action network idle', page.waitForLoadState('networkidle'));
  await settleReads();
  return exchange;
}
async function create(label, { method = 'single', maximum = 1 } = {}) {
  await nav('Ballots');
  const name = title(label);
  if (app === 'golden') {
    await page.getByRole('button', { name: 'New ballot', exact: true }).click();
    await page.locator('#ballot-title').fill(name);
    await page.locator('#ballot-description').fill('Independent local boundary control');
    await page.locator('#ballot-method').selectOption(method);
    if (method === 'approval') await page.locator('#ballot-limit').fill(String(maximum));
    const choices = page.locator('#choice-fields input[name="choice"]');
    await choices.nth(0).fill('Yes'); await choices.nth(1).fill('No');
  } else {
    await page.getByRole('button', { name: 'Reset to new draft', exact: true }).click();
    const form = page.locator('form[data-operation-form="ballot-editor"]');
    await form.locator('input[name="title"]').fill(name);
    await form.locator('textarea[name="description"]').fill('Independent local boundary control');
    await form.locator('select[name="method"]').selectOption(method);
    if (method === 'approval') await form.locator('input[name="maxSelections"]').fill(String(maximum));
    await form.locator('textarea[name="choices"]').fill('Yes\nNo');
  }
  const exchange = await uiWrite(() => app === 'golden'
    ? page.locator('#ballot-form').getByRole('button', { name: 'Save draft', exact: true }).click()
    : page.locator('form[data-operation-form="ballot-editor"]').getByRole('button', { name: 'Create draft', exact: true }).click());
  const id = exchange.body.ballot && exchange.body.ballot.id;
  if (!id) throw new Error('Successful visible creation did not expose its created ballot identity');
  await reload();
  return { id, title: name, exchange };
}
async function edit(fixture, label) {
  await nav('Ballots');
  if (app === 'golden') {
    await page.locator(`[data-ballot-edit="${fixture.id}"]`).click();
    await page.locator('#ballot-title').fill(title(label));
  } else {
    await page.locator(`[data-action="edit-draft"][data-ballot-id="${fixture.id}"]`).click();
    await page.locator('form[data-operation-form="ballot-editor"] input[name="title"]').fill(title(label));
  }
  const exchange = await uiWrite(() => app === 'golden'
    ? page.locator('#ballot-form').getByRole('button', { name: 'Save draft', exact: true }).click()
    : page.locator('form[data-operation-form="ballot-editor"]').getByRole('button', { name: 'Save draft', exact: true }).click());
  await reload(); return exchange;
}
async function open(fixture) {
  await nav('Ballots');
  const exchange = await uiWrite(() => app === 'golden'
    ? page.locator(`[data-ballot-action="open"][data-id="${fixture.id}"]`).click()
    : page.locator(`[data-action="ballot-open"][data-ballot-id="${fixture.id}"]`).click());
  await reload(); return exchange;
}
async function membership() {
  await nav('Members');
  const member = await memberNow();
  if (app === 'gpt') {
    await page.locator(`form[data-operation-form="membership"][data-user-id="${member.id}"] select[name="status"]`)
      .selectOption(member.active ? 'paused' : 'active');
  }
  const exchange = await uiWrite(() => app === 'golden'
    ? page.locator(`[data-member-id="${member.id}"]`).click()
    : page.locator(`form[data-operation-form="membership"][data-user-id="${member.id}"]`).getByRole('button', { name: 'Save', exact: true }).click());
  await reload(); return exchange;
}
function operationKey(exchange) {
  const key = Object.keys(exchange.request.body).find(item => /^operation_?id$/i.test(item));
  if (!key) throw new Error('Observed write has no operation identifier');
  return key;
}
function revisionKey(exchange) {
  const key = Object.keys(exchange.request.body).find(item => /revision/i.test(item));
  if (!key) throw new Error('Observed write has no required revision');
  return key;
}
function adapt(exchange, fixture, oldId) {
  const request = clone(exchange.request);
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  if (oldId && fixture) {
    const index = parts.findIndex(part => decodeURIComponent(part) === oldId);
    if (index < 0) throw new Error('Observed target identity not found in request path');
    parts[index] = encodeURIComponent(fixture.id); url.pathname = parts.join('/');
    request.url = url.toString();
  }
  request.body[operationKey(exchange)] = fresh();
  return request;
}
async function send(request) {
  const response = await context.request.fetch(request.url, { method: request.method, headers: request.headers,
    data: JSON.stringify(request.body) });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status(), body };
}
async function assertRefusal(name, request) {
  const before = await snapshot();
  const result = await send(request);
  const after = await snapshot();
  const refused = result.status >= 400 && result.status < 500;
  record(name, refused && equal(before, after), { request, response: result,
    refused, businessStateUnchanged: equal(before, after), before, after });
  await reload();
  return result;
}
async function originalReceipt(name, original) {
  const before = await snapshot(), result = await send(original.request), after = await snapshot();
  record(name, result.status === original.status && equal(result.body, original.body) && equal(before, after),
    { original, replay: result, exactStatusAndBody: result.status === original.status && equal(result.body, original.body),
      businessStateUnchanged: equal(before, after) });
}
async function positive(name, action) {
  const exchange = await action();
  record(name, exchange.status >= 200 && exchange.status < 300, { exchange });
  return exchange;
}
async function memberVote(fixture, person, sharedOperationId) {
  const memberContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let complete = false;
  try {
    const memberPage = await memberContext.newPage();
    memberPage.setDefaultTimeout(15000);
    await memberPage.goto(base, { waitUntil: 'networkidle' });
    await memberPage.locator('input[type="email"]').fill(`${person === 'Leila' ? 'leila.ward' : 'owen.park'}@commonground.example`);
    await memberPage.locator('input[type="password"]').fill('CommonGround!2026');
    await memberPage.getByRole('button', { name: 'Sign in', exact: true }).click();
    await memberPage.locator('nav').getByRole('button', { name: 'Vote', exact: true }).click();
    await memberPage.waitForLoadState('networkidle');
    if (app === 'golden') {
      await memberPage.locator(`[data-vote-id="${fixture.id}"]`).click();
      await memberPage.locator('#vote-options input[name="choice_id"]').first().check();
      await memberPage.locator('#vote-confirm').check();
    } else {
      await memberPage.locator(`form[data-operation-form="vote"][data-ballot-id="${fixture.id}"] input[name="choiceIds"]`).first().check();
    }
    let exchange;
    await memberPage.route(`${base}/**`, async route => {
      const original = route.request();
      if (!isWrite(original) || !isOperation(original)) { await route.continue(); return; }
      const body = clone(original.postDataJSON());
      const opKey = Object.keys(body).find(key => /^operation_?id$/i.test(key));
      if (sharedOperationId) body[opKey] = sharedOperationId;
      // This is the real Member UI submission. Only the already observed
      // operation-ID field is adapted for the cross-person namespace probe.
      const response = await route.fetch({ postData: JSON.stringify(body) });
      exchange = { request: { url: original.url(), method: original.method(), body,
        headers: { 'content-type': original.headers()['content-type'] || 'application/json' } },
        status: response.status(), body: await response.json() };
      await route.fulfill({ response });
    });
    const responsePromise = memberPage.waitForResponse(response => isWrite(response.request()) && isOperation(response.request()), { timeout: 20000 })
      .then(response => ({ response }), error => ({ error }));
    if (app === 'golden') await memberPage.locator('#vote-form').getByRole('button', { name: 'Submit final ballot', exact: true }).click();
    else await memberPage.locator(`form[data-operation-form="vote"][data-ballot-id="${fixture.id}"]`).getByRole('button', { name: 'Submit ballot', exact: true }).click();
    const captured = await responsePromise;
    if (captured.error) throw captured.error;
    if (!exchange) throw new Error(`${person}'s genuine UI vote was not captured`);
    await memberPage.unroute(`${base}/**`);
    await memberPage.reload({ waitUntil: 'networkidle' });
    const replayResponse = await memberContext.request.fetch(exchange.request.url, { method: exchange.request.method,
      headers: exchange.request.headers, data: JSON.stringify(exchange.request.body) });
    const replay = { status: replayResponse.status(), body: await replayResponse.json() };
    const result = { exchange, replay, visibleAfterReload: await memberPage.locator('body').innerText() };
    memberContexts.set(person, memberContext); complete = true;
    return result;
  } finally { if (!complete) await memberContext.close(); }
}
async function main() {
  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox'] });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000); context.setDefaultNavigationTimeout(15000);
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('response', response => {
    const request = response.request();
    if (request.method() !== 'GET' || !response.ok() || !response.url().startsWith(base)
      || !/json/i.test(response.headers()['content-type'] || '')) return;
    const pending = bounded(`observe JSON ${request.url()}`, response.json(), 10000).then(body => {
      if (observedBusiness(body)) reads.set(request.url(), { method: request.method(), headers: {} });
    }).catch(() => {});
    pendingReads.add(pending); pending.finally(() => pendingReads.delete(pending));
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('ruth.adebayo@commonground.example');
  await page.locator('input[type="password"]').fill('CommonGround!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: 'Ballots', exact: true }).waitFor();
  await nav('Members'); await nav('Audit'); await nav('Ballots');
  record('Visible Ruth sign-in and observed protected reads', Object.keys(await snapshot()).length > 0);

  let editTemplate, openTemplate, membershipTemplate, editSource, openSource;
  await independent('Capture edit positive control', async () => {
    editSource = await create('edit transport');
    editTemplate = await positive('Ordinary edit positive control', () => edit(editSource, 'captured edit'));
  });
  await independent('Capture Open positive control', async () => {
    openSource = await create('Open transport');
    openTemplate = await positive('Ordinary Open positive control', () => open(openSource));
  });
  await independent('Capture membership positive control', async () => {
    membershipTemplate = await positive('Ordinary membership positive control', () => membership());
  });

  await independent('Cross-action create to edit', async () => {
    if (!editTemplate) throw new Error('Successful observed edit transport unavailable');
    const fixture = await create('create edit namespace');
    const request = adapt(editTemplate, fixture, editSource.id);
    request.body[revisionKey(editTemplate)] = 1;
    request.body[operationKey(editTemplate)] = fixture.exchange.request.body[operationKey(fixture.exchange)];
    request.body.title = title('cross-action attempted edit');
    await assertRefusal('Same person cannot reuse create operation ID for edit', request);
    await originalReceipt('Original create receipt intact after cross-action edit', fixture.exchange);
    await positive('Fresh ordinary edit succeeds after collision probe', () => edit(fixture, 'fresh edit after collision'));
  });
  await independent('Cross-action create to membership', async () => {
    if (!membershipTemplate) throw new Error('Successful observed membership transport unavailable');
    const fixture = await create('create membership namespace'), current = await memberNow();
    const request = adapt(membershipTemplate);
    request.body[revisionKey(membershipTemplate)] = current.revision;
    request.body[operationKey(membershipTemplate)] = fixture.exchange.request.body[operationKey(fixture.exchange)];
    if ('active' in request.body) request.body.active = !current.active;
    else if ('status' in request.body) request.body.status = current.active ? 'paused' : 'active';
    else throw new Error('Observed membership status transport unsupported');
    await assertRefusal('Same person cannot reuse create operation ID for membership', request);
    await originalReceipt('Original create receipt intact after cross-action membership', fixture.exchange);
    await positive('Fresh ordinary membership succeeds after collision probe', () => membership());
  });

  const malformed = [
    ['array', revision => [revision]], ['object', revision => ({ revision })],
    ['boolean', () => true], ['null', () => null], ['missing', () => undefined],
  ];
  for (const family of ['edit', 'open']) {
    for (const [label, value] of malformed) {
      await independent(`${family} malformed ${label}`, async () => {
        const template = family === 'edit' ? editTemplate : openTemplate;
        const source = family === 'edit' ? editSource : openSource;
        if (!template) throw new Error(`Successful observed ${family} transport unavailable`);
        const fixture = await create(`${family} ${label} revision`);
        const request = adapt(template, fixture, source.id), key = revisionKey(template);
        if (label === 'missing') delete request.body[key]; else request.body[key] = value(1);
        if (family === 'edit') request.body.title = title(`malformed ${label} edit`);
        const result = await assertRefusal(`${family}: ${label} revision refused without mutation`, request);
        if (family === 'edit') {
          await positive(`${family}: ${label} fresh integer UI control`, () => edit(fixture, 'valid integer edit'));
        } else {
          // An accepted malformed Open consumes Draft. Preserve the failure and use
          // an independent genuine Draft for the valid-state positive control.
          const control = result.status >= 200 && result.status < 300 ? await create(`open ${label} independent control`) : fixture;
          await positive(`${family}: ${label} fresh integer UI control`, () => open(control));
        }
      });
    }
  }
  // Membership's revision has advanced during its positive controls. A boolean
  // true would coerce to 1 and a stale-only refusal would not isolate its type.
  // The fresh-revision-1 Draft edit/Open cases above own that boolean probe.
  for (const [label, value] of malformed.filter(([label]) => label !== 'boolean')) {
    await independent(`membership malformed ${label}`, async () => {
      if (!membershipTemplate) throw new Error('Successful observed membership transport unavailable');
      const current = await memberNow(), request = adapt(membershipTemplate), key = revisionKey(membershipTemplate);
      if (label === 'missing') delete request.body[key]; else request.body[key] = value(current.revision);
      if ('active' in request.body) request.body.active = !current.active;
      else request.body.status = current.active ? 'paused' : 'active';
      await assertRefusal(`membership: ${label} revision refused without mutation`, request);
      await positive(`membership: ${label} fresh integer UI control`, () => membership());
    });
  }
  let approvalTemplate;
  await independent('Capture approval maximum positive control', async () => {
    approvalTemplate = await create('approval maximum transport', { method: 'approval', maximum: 1 });
    record('Ordinary approval create with two choices and maximum 1', true, { exchange: approvalTemplate.exchange });
  });
  for (const [label, value] of malformed) {
    await independent(`approval maximum malformed ${label}`, async () => {
      if (!approvalTemplate) throw new Error('Successful observed approval creation unavailable');
      const request = adapt(approvalTemplate.exchange);
      const maximumKey = Object.keys(request.body).find(key => /max/i.test(key));
      if (!maximumKey) throw new Error('Approval maximum not found in genuine request');
      request.body.title = title(`approval malformed ${label}`);
      if (label === 'missing') delete request.body[maximumKey]; else request.body[maximumKey] = value(1);
      await assertRefusal(`approval maximum: ${label} refused without mutation`, request);
      const valid = await create(`approval ${label} valid control`, { method: 'approval', maximum: 1 });
      record(`approval maximum: ${label} fresh valid UI control`, true, { exchange: valid.exchange });
    });
  }
  await independent('Separate Members have independent operation namespaces', async () => {
    if (!(await memberNow()).active) await positive('Activate Owen for independent Member namespaces', () => membership());
    const fixture = await create('independent Member operation IDs');
    await positive('Open both-Member namespace control', () => open(fixture));
    const before = await snapshot();
    const first = await memberVote(fixture, 'Leila');
    record('Leila namespace UI vote positive control', first.exchange.status >= 200 && first.exchange.status < 300, first);
    const operationId = first.exchange.request.body[operationKey(first.exchange)];
    const second = await memberVote(fixture, 'Owen', operationId);
    record('Different Member can use same operation ID legitimately', second.exchange.status >= 200 && second.exchange.status < 300,
      { ...second, operationIdMatchesFirstMember: second.exchange.request.body[operationKey(second.exchange)] === operationId });
    for (const [person, result] of [['Leila', first], ['Owen', second]]) {
      const stateBeforeReplay = await snapshot();
      const replayResponse = await memberContexts.get(person).request.fetch(result.exchange.request.url, {
        method: result.exchange.request.method, headers: result.exchange.request.headers, data: JSON.stringify(result.exchange.request.body) });
      const replay = { status: replayResponse.status(), body: await replayResponse.json() };
      const stateAfterReplay = await snapshot();
      record(`${person} retains own receipt after both Members use shared ID`, replay.status === result.exchange.status && equal(replay.body, result.exchange.body) && equal(stateBeforeReplay, stateAfterReplay),
        { original: result.exchange, replay, businessStateUnchanged: equal(stateBeforeReplay, stateAfterReplay) });
    }
    const after = await snapshot();
    const ballot = Object.values(after).flatMap(data => data.ballots || []).find(item => item.id === fixture.id);
    const participated = app === 'golden' ? ballot?.turnout?.participated : ballot?.participantCount;
    record('Cross-person shared ID records two distinct participants', participated === 2, { participated, before, after });
  });
  await independent('Restore Owen paused through UI', async () => {
    if ((await memberNow()).active) await positive('Restore Owen paused', () => membership());
    record('Final Owen state paused', !(await memberNow()).active);
  });
}
main().catch(error => { errors.push({ stage: 'suite', message: error.message, stack: error.stack }); })
  .finally(async () => {
    if (browser) await browser.close(); save();
    console.log(JSON.stringify({ app, passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, errors: errors.length, output }));
    // GPT product failures are the intended negative baseline; driver failures are
    // always an unsuccessful execution. Golden must satisfy every boundary.
    process.exitCode = errors.length || (app === 'golden' && checks.some(c => !c.passed)) ? 1 : 0;
  });
