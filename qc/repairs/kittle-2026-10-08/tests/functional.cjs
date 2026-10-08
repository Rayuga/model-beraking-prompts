// Scripted golden checks that follow Kittle's constraints gate, its 16 functional
// criteria and the polish refusal check step by step, in order, on one database like
// the judge does. Phase "before" runs everything up to the persistence restart and
// saves what must survive; phase "after" re-reads it after a real process restart.
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const B = 'http://localhost:3000';
const STATE = '/state/persist-state.json';
const phase = process.argv[2] || 'before';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = {};
const dialogs = [];
let browser;

async function ctx() {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await c.newPage();
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  page.requests = [];
  page.on('request', r => page.requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
  return page;
}
async function signIn(page, email) {
  await page.goto(B + '/');
  await page.waitForSelector('#email');
  await page.fill('#email', email); await page.fill('#password', 'password123');
  await page.click('#signin-form button[type=submit]');
  await page.waitForSelector('#app:not([hidden]) .matter-link');
}
async function home(page) { await page.goto(B + '/'); await page.waitForSelector('.matter-link'); }
const api = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const r = await fetch(p, { method: m, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
  let d; try { d = await r.json(); } catch { d = null; }
  return { status: r.status, data: d };
}, [method, path, body]);
const replay = (page, req) => page.evaluate(async r => {
  const res = await fetch(r.url, { method: r.method, headers: { 'content-type': 'application/json' }, body: r.body || undefined });
  let d; try { d = await res.json(); } catch { d = null; }
  return { status: res.status, data: d };
}, req);
const lastReq = (page, method, re) => [...page.requests].reverse().find(r => r.method === method && re.test(r.url));
async function openMatter(page, id) {
  await page.click(`.matter-link[href="/matters/${id}"]`);
  await page.waitForFunction(i => document.querySelector('#matter-title')?.textContent.startsWith(i), id);
  await sleep(300);
}
async function post(page, text) {
  await page.fill('#composer-input', text);
  await page.click('#composer-send');
  await page.waitForFunction(t => [...document.querySelectorAll('#thread .message .body')].some(b => b.textContent.includes(t)), text.split(' ').pop());
  await sleep(150);
}
const msgLi = (page, text) => page.locator('#thread li.message').filter({ has: page.locator('.body', { hasText: text }) }).last();
const idOf = async (page, text) => (await msgLi(page, text).getAttribute('id')).replace('msg-', '');
async function reply(page, parentText, text) {
  await msgLi(page, parentText).locator('button', { hasText: /^Reply$/ }).click();
  await post(page, text);
}
async function del(page, text) {
  await msgLi(page, text).locator('button', { hasText: /^Delete$/ }).click();
  await page.waitForFunction(t => ![...document.querySelectorAll('#thread .message .body')].some(b => b.textContent.includes(t)), text);
}
async function copyLink(page, text) {
  await msgLi(page, text).locator('button', { hasText: 'Copy link' }).click();
  return page.inputValue('#link-value');
}
async function search(page, q) {
  await page.fill('#search-input', q); await page.click('#search-form button');
  await page.waitForFunction(() => !document.querySelector('#search-view').hidden);
  await sleep(400);
  return page.locator('#results .result-text').allTextContents();
}
async function transcript(page, id) {
  const res = await page.request.get(`${B}/transcripts/${id}`);
  return { status: res.status(), html: await res.text() };
}
async function setTimer(page, v) {
  await page.selectOption('#timer-select', v); await page.click('#timer-form button');
  const label = v === 'off' ? 'off' : `${v} day`;
  await page.waitForFunction(l => document.querySelector('#matter-timer').textContent.includes(l), label);
}
const depthOf = (page, text) => msgLi(page, text).evaluate(el => Number(getComputedStyle(el).getPropertyValue('--depth') || el.style.getPropertyValue('--depth')));
const threadItems = page => page.locator('#thread li').evaluateAll(els => els.map(e => e.className + '|' + (e.querySelector('.body')?.textContent || e.textContent)));
const unreadIs = (page, id, n) => page.waitForFunction(([i, k]) => Number(document.querySelector(`.matter-link[href="/matters/${i}"] .badge`)?.textContent || 0) === k, [id, n], { timeout: 10000 });
async function unreadOf(page, id) {
  const badge = page.locator(`.matter-link[href="/matters/${id}"] .badge`);
  return (await badge.count()) ? Number(await badge.textContent()) : 0;
}
async function check(name, body) {
  try { await body(); results[name] = true; }
  catch (e) { results[name] = String(e.message || e).split('\n').slice(0, 4).join(' | '); }
  console.log(name, results[name] === true ? 'PASS' : 'FAIL ' + results[name]);
}

async function before() {
  const gwen = await ctx(); const harriet = await ctx(); const dev = await ctx(); const sian = await ctx();

  await check('gate_constraints', async () => {
    await signIn(gwen, 'gwen@kittle.test'); await openMatter(gwen, 'M-11');
    await post(gwen, 'Gate check JUDGE-G1');
    await gwen.reload(); await gwen.waitForSelector('.matter-link'); await openMatter(gwen, 'M-11');
    assert.equal(await msgLi(gwen, 'Gate check JUDGE-G1').count(), 1);
    await signIn(harriet, 'harriet@kittle.test'); await openMatter(harriet, 'M-11');
    assert.equal(await msgLi(harriet, 'Gate check JUDGE-G1').count(), 1);
  });

  await check('signin_and_client_scope', async () => {
    await home(harriet); await openMatter(harriet, 'M-11');
    await post(harriet, '@Gwen please check JUDGE-CS0');
    gwen.requests.length = 0;
    await home(gwen);
    const lreq = lastReq(gwen, 'GET', /\/api\/matters$/);
    const titles = await gwen.locator('.matter-link').allTextContents();
    assert.ok(titles.some(t => t.includes('Pryce lease dispute')) && titles.some(t => t.includes('Pryce will')));
    assert.ok(!titles.some(t => t.includes('Marsh')));
    gwen.requests.length = 0;
    await openMatter(gwen, 'M-11');
    const load = lastReq(gwen, 'GET', /\/api\/matters\/M-11$/);
    await gwen.click('#mentions-link'); await sleep(500);
    assert.ok((await gwen.locator('#mentions-view').innerText()).includes('JUDGE-CS0'), 'mention shown');
    const mreq = lastReq(gwen, 'GET', /\/api\/mentions/);
    assert.ok((await search(gwen, 'Survey')).some(t => t.includes('Survey booked for Friday.')));
    const sreq = lastReq(gwen, 'GET', /\/api\/search/);
    const tOk = await gwen.request.get(`${B}/transcripts/M-11`); assert.equal(tOk.status(), 200);
    await home(gwen);
    await gwen.click('#signout'); await gwen.waitForSelector('#signin:not([hidden])');
    assert.ok(!(await gwen.locator('body').innerText()).includes('Pryce'));
    for (const q of [lreq, load, mreq, sreq]) {
      const r = await replay(gwen, q);
      assert.equal(r.status, 401); assert.ok(!/Pryce|Survey|Gwen|Harriet/.test(JSON.stringify(r.data)), q.url);
    }
    const tOut = await gwen.request.get(`${B}/transcripts/M-11`);
    assert.ok(tOut.status() >= 400 && !(await tOut.text()).includes('Survey booked'));
    await gwen.fill('#email', 'harriet@kittle.test'); await gwen.fill('#password', 'wrong'); await gwen.click('#signin-form button[type=submit]');
    await gwen.waitForSelector('#signin-error:not([hidden])');
    assert.ok(await gwen.locator('#signin:not([hidden])').count());
    await signIn(gwen, 'gwen@kittle.test');
    await openMatter(gwen, 'M-11'); gwen.requests.length = 0;
    await post(gwen, 'Lease question JUDGE-CS1');
    const req = lastReq(gwen, 'POST', /\/api\/matters\/M-11\/messages$/);
    assert.equal((await replay(gwen, { ...req, url: req.url.replace('M-11', 'M-12') })).status, 404);
    harriet.requests.length = 0; await openMatter(harriet, 'M-12');
    const h12 = lastReq(harriet, 'GET', /\/api\/matters\/M-12$/);
    assert.equal((await replay(gwen, h12)).status, 404);
    const gt = await gwen.request.get(`${B}/transcripts/M-12`); assert.equal(gt.status(), 404); assert.ok(!(await gt.text()).includes('Marsh'));
    assert.ok(!JSON.stringify((await api(harriet, 'GET', '/api/matters/M-12')).data).includes('JUDGE-CS1'));
  });

  await check('wall_every_route', async () => {
    await signIn(sian, 'sian@kittle.test'); await openMatter(sian, 'M-12');
    await post(sian, 'Wall check JUDGE-W0');
    sian.requests.length = 0;
    await home(sian); await openMatter(sian, 'M-11'); await openMatter(sian, 'M-12');
    const slist = lastReq(sian, 'GET', /\/api\/matters$/);
    const load = lastReq(sian, 'GET', /\/api\/matters\/M-12$/);
    const tr = { url: `${B}/transcripts/M-12`, method: 'GET' };
    assert.ok((await (await sian.request.get(tr.url)).text()).includes('Wall check JUDGE-W0'));
    assert.ok((await search(sian, 'JUDGE-W0')).some(t => t.includes('Wall check JUDGE-W0')));
    const sreq = lastReq(sian, 'GET', /\/api\/search/);
    await signIn(dev, 'dev@kittle.test');
    const list = await dev.locator('#matter-list').innerText();
    assert.ok(list.includes('M-11') && list.includes('M-13') && !list.includes('M-12') && !list.includes('Marsh'));
    for (const q of ['JUDGE-W0', 'heads of terms', 'Fenwick']) assert.deepEqual(await search(dev, q), []);
    assert.equal((await replay(dev, load)).status, 404);
    const dl = JSON.stringify((await replay(dev, slist)).data);
    assert.ok(!dl.includes('M-12') && !dl.includes('Marsh'), 'matter list replay');
    assert.ok(!JSON.stringify((await replay(dev, sreq)).data).includes('M-12'));
    const t = await dev.request.get(tr.url); assert.equal(t.status(), 404); assert.ok(!(await t.text()).includes('Marsh'));
    await dev.goto(B + '/transcripts/M-12'); assert.ok((await dev.locator('body').innerText()).includes('Not available'));
    await home(dev);
  });

  await check('wall_mentions_and_links', async () => {
    await openMatter(harriet, 'M-12');
    const link = await copyLink(harriet, 'Draft heads of terms ready for comment.');
    await openMatter(harriet, 'M-11');
    await post(harriet, 'See the linked terms JUDGE-L1 ' + link);
    assert.ok((await msgLi(harriet, 'JUDGE-L1').locator('.preview').innerText()).includes('heads of terms'));
    await harriet.goto(link);
    await harriet.waitForFunction(() => location.pathname === '/matters/M-12' && document.querySelector('.message.focused'));
    await home(harriet); await openMatter(harriet, 'M-12');
    await post(harriet, '@Dev please review JUDGE-M1');
    await openMatter(harriet, 'M-11');
    await post(harriet, '@Dev survey update JUDGE-M2');
    await home(dev); await openMatter(dev, 'M-11');
    const pv = await msgLi(dev, 'JUDGE-L1').locator('.preview').innerText();
    assert.ok(/not available/i.test(pv) && !pv.includes('heads') && !pv.includes('Marsh'), pv);
    await dev.goto(link); await sleep(800);
    const body = await dev.locator('#main').innerText();
    assert.ok(/not available/i.test(body) && !body.includes('heads of terms'), body.slice(0, 200));
    const texts = JSON.stringify((await api(dev, 'GET', '/api/mentions')).data);
    assert.ok(texts.includes('JUDGE-M2') && !texts.includes('JUDGE-M1') && !texts.includes('M-12'), texts);
    await home(dev);
  });

  await check('wall_added_live', async () => {
    await openMatter(sian, 'M-13'); sian.requests.length = 0;
    await post(sian, 'Before wall JUDGE-WL0');
    const preq = lastReq(sian, 'POST', /\/messages$/);
    await openMatter(harriet, 'M-13'); harriet.requests.length = 0;
    await harriet.selectOption('#wall-select', 'dev@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Dev'));
    await harriet.locator('#wall-list button', { hasText: 'Lift wall' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#wall-list').textContent.includes('Dev'));
    const liftReq = lastReq(harriet, 'POST', /\/walls$/);
    await harriet.selectOption('#wall-select', 'sian@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Sian'));
    await sian.waitForFunction(() => !document.querySelector('#matter-list').textContent.includes('M-13') && /Not available/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    assert.equal((await replay(sian, { ...preq, body: JSON.stringify({ body: 'Too late JUDGE-WL1', client_key: 'wl1' }) })).status, 404);
    assert.ok(!JSON.stringify((await api(harriet, 'GET', '/api/matters/M-13')).data).includes('JUDGE-WL1'));
    const lift = { ...liftReq, body: liftReq.body.replace('dev@kittle.test', 'sian@kittle.test') };
    assert.equal(JSON.parse(liftReq.body).email, 'dev@kittle.test');
    assert.ok([403, 404].includes((await replay(sian, lift)).status));
    assert.equal((await api(sian, 'GET', '/api/matters/M-13')).status, 404);
    await harriet.locator('#wall-list button', { hasText: 'Lift wall' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#wall-list').textContent.includes('Sian'));
    await sian.reload(); await sian.waitForSelector('.matter-link'); await openMatter(sian, 'M-13');
    assert.equal(await msgLi(sian, 'Before wall JUDGE-WL0').count(), 1);
  });

  await check('nested_replies', async () => {
    await openMatter(harriet, 'M-13');
    await post(harriet, 'Root question JUDGE-R0');
    await reply(harriet, 'JUDGE-R0', 'Level one JUDGE-R1');
    await reply(harriet, 'Level one JUDGE-R1', 'Level two JUDGE-R2');
    await reply(harriet, 'Level two JUDGE-R2', 'Level three JUDGE-R3');
    await post(harriet, 'Unrelated JUDGE-RX');
    await reply(harriet, 'Root question JUDGE-R0', 'Another level one JUDGE-R1B');
    await home(gwen); await openMatter(gwen, 'M-13');
    for (const p of [harriet, gwen]) {
      assert.deepEqual([await depthOf(p, 'Level one JUDGE-R1'), await depthOf(p, 'Level two JUDGE-R2'), await depthOf(p, 'Level three JUDGE-R3'), await depthOf(p, 'Another level one JUDGE-R1B')], [1, 2, 3, 1]);
      const order = (await p.locator('#thread li.message .body').allTextContents()).map(t => (t.match(/JUDGE-R\w+/) || [])[0]).filter(Boolean);
      assert.ok(order.indexOf('JUDGE-R3') < order.indexOf('JUDGE-R1B') && order.indexOf('JUDGE-R1B') < order.indexOf('JUDGE-RX'), order.join(','));
      assert.ok((await msgLi(p, 'Level two JUDGE-R2').locator('.quote').innerText()).includes('Level one JUDGE-R1'));
    }
  });

  await check('deleted_and_expired_messages', async () => {
    await openMatter(gwen, 'M-11');
    assert.ok(!(await gwen.locator('#thread').innerText()).includes('original lease scan'));
    assert.match(await msgLi(gwen, 'Clause 14 noted').locator('.quote').innerText(), /deleted/i);
    assert.equal(await depthOf(gwen, 'Thank you, the deadline'), 2);
    assert.deepEqual(await search(gwen, 'original lease scan'), []);
    assert.equal((await search(gwen, 'Clause 14 noted')).length, 1);
    await home(gwen); await openMatter(gwen, 'M-11');
    await post(gwen, 'Delete parent JUDGE-X0');
    await openMatter(harriet, 'M-11'); await sleep(2500);
    await reply(harriet, 'Delete parent JUDGE-X0', 'Reply stays JUDGE-X1');
    await openMatter(gwen, 'M-13'); await openMatter(gwen, 'M-11'); gwen.requests.length = 0;
    await del(gwen, 'Delete parent JUDGE-X0');
    const dreq = lastReq(gwen, 'DELETE', /\/api\/messages\//);
    assert.match(await msgLi(gwen, 'Reply stays JUDGE-X1').locator('.quote').innerText(), /deleted/i);
    assert.deepEqual(await search(gwen, 'JUDGE-X0'), []);
    assert.equal((await search(gwen, 'JUDGE-X1')).length, 1);
    await home(sian); await openMatter(sian, 'M-11');
    const x1 = await idOf(sian, 'Reply stays JUDGE-X1');
    assert.equal((await replay(sian, { ...dreq, url: dreq.url.replace(/K-\d+$/, x1) })).status, 403);
    assert.equal((await api(harriet, 'GET', '/api/matters/M-11')).data.messages.filter(m => m.id === x1 && !m.deleted).length, 1);
    const t = (await transcript(gwen, 'M-11')).html;
    assert.ok((t.match(/Original message deleted/g) || []).length >= 2 && t.includes('Reply stays JUDGE-X1') && t.includes('Clause 14 noted'));
    assert.ok(!t.includes('original lease scan') && !t.includes('Delete parent JUDGE-X0'));
    const text = await harriet.locator('#thread').innerText();
    assert.ok(!text.includes('Boundary note') && text.includes('Rent review meeting moved'));
    assert.deepEqual(await search(harriet, 'rent review date'), []);
    assert.ok(!(await transcript(harriet, 'M-11')).html.includes('Boundary note'));
    await home(gwen); await home(harriet);
  });

  await check('timer_changes', async () => {
    await openMatter(harriet, 'M-13');
    let text = await harriet.locator('#thread').innerText();
    assert.ok(text.includes('Probate estimate is 4,200 pounds.') && text.includes('My executor will be my sister.'));
    harriet.requests.length = 0;
    await msgLi(harriet, 'Probate estimate').locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Probate estimate is 2,400 pounds.'));
    const vreq = lastReq(harriet, 'GET', /\/versions$/);
    harriet.requests.length = 0;
    await setTimer(harriet, '7');
    const treq = lastReq(harriet, 'POST', /\/timer$/);
    await sleep(500);
    text = await harriet.locator('#thread').innerText();
    assert.ok(!text.includes('Probate estimate'));
    assert.equal(await msgLi(harriet, 'My executor').locator('.hold-badge').count(), 1);
    const vr = await replay(harriet, vreq);
    assert.equal(vr.status, 404); assert.ok(!/2,400|4,200/.test(JSON.stringify(vr.data)));
    for (const q of ['Probate', '2,400', '4,200']) assert.deepEqual(await search(harriet, q), []);
    assert.ok((await search(harriet, 'executor')).some(s => s.includes('My executor')));
    const t = (await transcript(harriet, 'M-13')).html;
    assert.ok(!t.includes('2,400') && !t.includes('4,200') && t.includes('My executor will be my sister.'));
    await home(harriet); await openMatter(harriet, 'M-13');
    await setTimer(harriet, 'off');
    assert.ok(!(await harriet.locator('#thread').innerText()).includes('Probate'));
    await setTimer(harriet, '30');
    await home(sian);
    assert.equal((await replay(sian, { ...treq, body: JSON.stringify({ days: 1 }) })).status, 403);
    await home(harriet); await openMatter(harriet, 'M-13');
    assert.ok((await harriet.locator('#matter-timer').innerText()).includes('30 days'));
  });

  await check('hold_scope_and_release', async () => {
    await openMatter(harriet, 'M-11'); harriet.requests.length = 0;
    await post(harriet, 'Delete me JUDGE-H3');
    await del(harriet, 'Delete me JUDGE-H3');
    const dreq = lastReq(harriet, 'DELETE', /\/api\/messages\//);
    await post(harriet, 'Hold parent JUDGE-H0');
    await reply(harriet, 'Hold parent JUDGE-H0', 'Hold child JUDGE-H1');
    await reply(harriet, 'Hold child JUDGE-H1', 'Hold grandchild JUDGE-H1C');
    await msgLi(harriet, 'Hold child JUDGE-H1').locator('button', { hasText: 'Place hold' }).click();
    await harriet.waitForFunction(() => [...document.querySelectorAll('#thread li.message')].some(l => l.querySelector('.body')?.textContent.includes('Hold child JUDGE-H1') && l.querySelector('.hold-badge')));
    const hreq = lastReq(harriet, 'POST', /\/hold$/);
    await home(gwen); await openMatter(gwen, 'M-11');
    assert.equal(await msgLi(gwen, 'Hold child JUDGE-H1').locator('.hold-badge').count(), 1);
    assert.equal(await msgLi(gwen, 'Hold parent JUDGE-H0').locator('.hold-badge').count(), 0);
    assert.equal(await msgLi(gwen, 'Hold grandchild JUDGE-H1C').locator('.hold-badge').count(), 0);
    const h1 = await idOf(harriet, 'Hold child JUDGE-H1');
    const h0 = await idOf(harriet, 'Hold parent JUDGE-H0');
    await msgLi(harriet, 'Hold child JUDGE-H1').locator('button', { hasText: /^Delete$/ }).click();
    await harriet.waitForFunction(() => [...document.querySelectorAll('#thread li.message')].some(l => l.querySelector('.body')?.textContent.includes('Hold child JUDGE-H1') && l.querySelector('.action-error:not([hidden])')));
    assert.equal((await replay(harriet, { ...dreq, url: dreq.url.replace(/K-\d+$/, h1) })).status, 409);
    assert.equal(await msgLi(harriet, 'Hold child JUDGE-H1').count(), 1);
    await home(sian); await openMatter(sian, 'M-11');
    assert.equal((await replay(sian, { ...hreq, url: hreq.url.replace(/K-\d+(?=\/hold$)/, h0) })).status, 403);
    assert.equal((await api(harriet, 'GET', '/api/matters/M-11')).data.messages.find(m => m.id === h0).hold, false);
    await post(harriet, 'Not really On hold JUDGE-H2');
    assert.equal(await msgLi(harriet, 'JUDGE-H2').locator('.hold-badge').count(), 0);
    await sleep(2500);
    assert.ok((await msgLi(harriet, 'Hold child JUDGE-H1').locator('.action-error').innerText()).trim().length > 0, 'refusal kept after re-render');
    harriet.requests.length = 0;
    await msgLi(harriet, 'Insurer letter acknowledged.').locator('button', { hasText: 'Release hold' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#thread').textContent.includes('Insurer letter'));
    const rreq = lastReq(harriet, 'POST', /\/hold$/);
    assert.deepEqual(await search(harriet, 'Insurer letter'), []);
    assert.ok((await search(harriet, 'Hold child JUDGE-H1')).some(t => t.includes('Hold child JUDGE-H1')));
    assert.equal((await replay(sian, { ...rreq, url: rreq.url.replace(/K-\d+(?=\/hold$)/, h1) })).status, 403);
    assert.equal((await api(harriet, 'GET', '/api/matters/M-11')).data.messages.find(m => m.id === h1).hold, true);
  });

  await check('edits_and_stale_edit', async () => {
    await home(gwen); await openMatter(gwen, 'M-13');
    await post(gwen, 'Version one <i>JUDGE-E1</i>');
    const gwen2 = await ctx(); await signIn(gwen2, 'gwen@kittle.test'); await openMatter(gwen2, 'M-13');
    await msgLi(gwen2, 'JUDGE-E1').locator('button', { hasText: 'Edit' }).click();
    assert.equal(await gwen2.inputValue('#composer-input'), 'Version one <i>JUDGE-E1</i>');
    gwen.requests.length = 0;
    await msgLi(gwen, 'JUDGE-E1').locator('button', { hasText: 'Edit' }).click();
    await gwen.fill('#composer-input', 'Version two JUDGE-E1'); await gwen.click('#composer-send');
    await gwen.waitForFunction(() => [...document.querySelectorAll('#thread li.message')].some(l => l.textContent.includes('Version two JUDGE-E1') && l.querySelector('.edited')));
    const ereq = lastReq(gwen, 'PATCH', /\/api\/messages\//);
    await home(harriet); await openMatter(harriet, 'M-13');
    await msgLi(harriet, 'Version two JUDGE-E1').locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Version one <i>JUDGE-E1</i>'));
    assert.equal(await harriet.locator('.versions i').count(), 0);
    await gwen2.fill('#composer-input', 'Version stale JUDGE-E1'); await gwen2.click('#composer-send');
    await gwen2.waitForSelector('#composer-error:not([hidden])');
    assert.equal(await gwen2.inputValue('#composer-input'), 'Version stale JUDGE-E1');
    await gwen2.reload(); await gwen2.waitForSelector('.matter-link'); await openMatter(gwen2, 'M-13');
    let text = await gwen2.locator('#thread').innerText();
    assert.ok(text.includes('Version two JUDGE-E1') && !text.includes('Version stale'));
    await gwen2.context().close();
    await home(sian);
    assert.equal((await replay(sian, { ...ereq, body: JSON.stringify({ ...JSON.parse(ereq.body), body: 'Hijack JUDGE-E1' }) })).status, 403);
    assert.ok(!JSON.stringify((await api(harriet, 'GET', '/api/matters/M-13')).data).includes('Hijack'));
    const t = (await transcript(gwen, 'M-13')).html;
    const at = t.indexOf('Version two JUDGE-E1');
    assert.ok(at > 0 && /edited/.test(t.slice(Math.max(0, at - 600), at + 200)));
  });

  await check('safe_formatting', async () => {
    await home(gwen); await openMatter(gwen, 'M-13');
    const payload = 'Notes JUDGE-F1 *bold part* `code part` <img src=x onerror=alert(7)> <script>alert(8)</script> [click](javascript:alert(9)) https://example.org/lease';
    await post(gwen, payload);
    await reply(gwen, 'Notes JUDGE-F1', '> quoted line JUDGE-F2');
    const li = msgLi(gwen, 'Notes JUDGE-F1');
    assert.equal(await li.locator('.body strong').textContent(), 'bold part');
    assert.equal(await li.locator('.body code').textContent(), 'code part');
    assert.equal(await li.locator('.body a').getAttribute('target'), '_blank');
    assert.equal(await li.locator('.body a').count(), 1);
    assert.ok((await li.locator('.body').innerText()).includes('<img src=x onerror=alert(7)>'));
    assert.equal(await gwen.locator('#thread img, #thread script').count(), 0);
    assert.equal(await msgLi(gwen, 'quoted line JUDGE-F2').locator('.body blockquote').count(), 1);
    assert.ok((await msgLi(gwen, 'quoted line JUDGE-F2').locator('.quote').innerText()).includes('<img'));
    assert.ok((await search(gwen, 'JUDGE-F1')).some(s => s.includes('<script>alert(8)</script>')));
    assert.equal(await gwen.locator('#results img, #results script').count(), 0);
    const t = await transcript(gwen, 'M-13'); assert.ok(t.html.includes('&lt;img src=x') && !t.html.includes('<img src=x'));
    await home(gwen); await openMatter(gwen, 'M-11');
    assert.ok((await msgLi(gwen, 'Pasted from the lease').locator('.body').innerText()).includes('<b>Schedule 2</b>'));
    assert.equal(await msgLi(gwen, 'Pasted from the lease').locator('.body b').count(), 0);
    assert.ok((await transcript(gwen, 'M-11')).html.includes('&lt;b&gt;Schedule 2&lt;/b&gt;'));
    assert.deepEqual(dialogs, []);
  });

  await check('message_links', async () => {
    await home(harriet); await openMatter(harriet, 'M-13');
    const link = await copyLink(harriet, 'Draft will sent for your review.');
    await openMatter(harriet, 'M-11');
    await post(harriet, 'See draft JUDGE-P1 ' + link);
    assert.ok((await msgLi(harriet, 'JUDGE-P1').locator('.preview').innerText()).includes('Draft will sent'));
    await home(gwen); await openMatter(gwen, 'M-11');
    await msgLi(gwen, 'JUDGE-P1').locator('.preview a').click();
    await gwen.waitForFunction(() => location.pathname === '/matters/M-13' && document.querySelector('#msg-K-8.focused'));
    await openMatter(harriet, 'M-13');
    await post(harriet, 'Temp JUDGE-P2');
    const link2 = await copyLink(harriet, 'Temp JUDGE-P2');
    await openMatter(harriet, 'M-11');
    await post(harriet, 'Gone soon JUDGE-P3 ' + link2);
    assert.ok((await msgLi(harriet, 'JUDGE-P3').locator('.preview').innerText()).includes('Temp JUDGE-P2'));
    await openMatter(harriet, 'M-13');
    await del(harriet, 'Temp JUDGE-P2');
    await openMatter(harriet, 'M-11');
    const pv = await msgLi(harriet, 'JUDGE-P3').locator('.preview').innerText();
    assert.ok(/not available/i.test(pv) && !pv.includes('Temp'), pv);
  });

  await check('unread_and_new_messages_line', async () => {
    const devB = await ctx(); await signIn(devB, 'dev@kittle.test');
    await home(dev);
    await openMatter(dev, 'M-13'); await openMatter(dev, 'M-11');
    for (const p of [dev, devB]) await unreadIs(p, 'M-13', 0);
    await home(harriet); await openMatter(harriet, 'M-13');
    await post(harriet, 'Unread one JUDGE-U1'); await post(harriet, 'Unread two JUDGE-U2'); await post(harriet, 'Unread gone JUDGE-U3');
    await del(harriet, 'Unread gone JUDGE-U3');
    for (const p of [dev, devB]) await unreadIs(p, 'M-13', 2);
    await openMatter(dev, 'M-13');
    const items = await threadItems(dev);
    const line = items.findIndex(t => t.startsWith('new-line'));
    assert.ok(line >= 0 && items[line + 1].includes('JUDGE-U1'), 'line above U1');
    await unreadIs(devB, 'M-13', 0);
    await msgLi(dev, 'Unread two JUDGE-U2').locator('button', { hasText: 'Mark unread' }).click();
    for (const p of [dev, devB]) await unreadIs(p, 'M-13', 1);
    await home(dev); await openMatter(dev, 'M-13');
    const items2 = await threadItems(dev);
    const line2 = items2.findIndex(t => t.startsWith('new-line'));
    assert.ok(line2 >= 0 && items2[line2 + 1].includes('JUDGE-U2'), 'line above U2');
    await home(gwen);
    assert.ok((await unreadOf(gwen, 'M-13')) >= 2, 'gwen count is her own');
    await devB.context().close(); await home(dev);
  });

  await check('sent_once_in_order', async () => {
    await home(sian); await openMatter(sian, 'M-11'); sian.requests.length = 0;
    await post(sian, 'Sent once JUDGE-D1');
    const req = lastReq(sian, 'POST', /\/messages$/);
    await replay(sian, req); await replay(sian, req);
    await sian.reload(); await sian.waitForSelector('.matter-link'); await openMatter(sian, 'M-11');
    assert.equal(await sian.locator('#thread li.message .body', { hasText: 'Sent once JUDGE-D1' }).count(), 1);
    assert.equal((await search(sian, 'JUDGE-D1')).length, 1);
    assert.equal((await transcript(sian, 'M-11')).html.split('Sent once JUDGE-D1').length - 1, 1);
    await home(sian); await openMatter(sian, 'M-11');
    await post(sian, 'Sent once JUDGE-D2');
    assert.equal(await sian.locator('#thread li.message .body', { hasText: 'JUDGE-D2' }).count(), 1);
    await home(harriet); await openMatter(harriet, 'M-11');
    for (const k of ['C', 'A', 'B']) await post(harriet, `Order ${k} JUDGE-O`);
    const order = async p => (await p.locator('#thread li.message .body').allTextContents()).map(t => (t.match(/Order ([ABC]) JUDGE-O/) || [])[1]).filter(Boolean).join('');
    await harriet.reload(); await harriet.waitForSelector('.matter-link'); await openMatter(harriet, 'M-11');
    assert.equal(await order(harriet), 'CAB');
    for (const k of ['A', 'B', 'C']) assert.ok((await msgLi(harriet, `Order ${k} JUDGE-O`).locator('time').innerText()).includes('2026-05-12 11:00'));
    await home(gwen); await openMatter(gwen, 'M-11'); assert.equal(await order(gwen), 'CAB');
    assert.equal((await search(gwen, 'JUDGE-O')).map(s => s.match(/Order (\w)/)[1]).join(''), 'CAB');
    const t = (await transcript(gwen, 'M-11')).html;
    assert.ok(t.indexOf('Order C') < t.indexOf('Order A') && t.indexOf('Order A') < t.indexOf('Order B'));
    const oc = t.slice(t.lastIndexOf('<li', t.indexOf('Order C')), t.indexOf('Order C'));
    assert.ok(oc.includes('2026-05-12 11:00'), 'transcript sent time');
  });

  await check('live_updates_keep_my_work', async () => {
    await home(harriet); await openMatter(harriet, 'M-13');
    await post(harriet, 'Live base JUDGE-LB'); await post(harriet, 'Live gone JUDGE-LG');
    await home(gwen); await openMatter(gwen, 'M-13');
    await msgLi(gwen, 'Draft will sent for your review.').locator('button', { hasText: /^Reply$/ }).click();
    await gwen.fill('#composer-input', 'Half typed JUDGE-LV');
    await gwen.evaluate(() => { const t = document.querySelector('#thread'); t.scrollTop = Math.max(0, t.scrollHeight / 3); });
    const top = await gwen.evaluate(() => document.querySelector('#thread').scrollTop);
    await post(harriet, 'Live arrival JUDGE-LA');
    await reply(harriet, 'Live base JUDGE-LB', 'Live reply JUDGE-LR');
    await msgLi(harriet, 'Live base JUDGE-LB').locator('button', { hasText: 'Edit' }).click();
    await harriet.fill('#composer-input', 'Live base JUDGE-LB JUDGE-LE'); await harriet.click('#composer-send');
    await harriet.waitForFunction(() => document.querySelector('#thread').textContent.includes('JUDGE-LE'));
    await del(harriet, 'Live gone JUDGE-LG');
    await gwen.waitForFunction(() => { const t = document.querySelector('#thread').textContent; return t.includes('JUDGE-LA') && t.includes('JUDGE-LE') && t.includes('JUDGE-LR') && !t.includes('Live gone JUDGE-LG'); }, null, { timeout: 10000 });
    assert.equal(await depthOf(gwen, 'Live reply JUDGE-LR'), 1);
    assert.equal(await gwen.inputValue('#composer-input'), 'Half typed JUDGE-LV');
    assert.ok((await gwen.locator('#composer-context').innerText()).includes('Draft will sent'));
    const top2 = await gwen.evaluate(() => document.querySelector('#thread').scrollTop);
    assert.ok(Math.abs(top2 - top) < 40, `scroll ${top} -> ${top2}`);
    await gwen.click('#composer-cancel');
  });

  await check('search_and_transcript', async () => {
    const res = await search(gwen, 'survey BOOKED');
    assert.ok(res.some(t => t.includes('Survey booked for Friday.')));
    await gwen.locator('#results a', { hasText: 'Survey booked for Friday.' }).click();
    await gwen.waitForFunction(() => location.pathname === '/matters/M-11' && document.querySelector('#msg-K-3.focused'));
    assert.deepEqual(await search(gwen, 'notice recieved'), []);
    assert.equal((await search(gwen, 'notice received and filed')).length, 1);
    assert.deepEqual(await search(gwen, 'heads of terms'), []);
    await home(harriet); await openMatter(harriet, 'M-11');
    await post(harriet, 'Transcript parent JUDGE-T0');
    await reply(harriet, 'Transcript parent JUDGE-T0', 'Transcript child JUDGE-T1');
    const t = (await transcript(harriet, 'M-11')).html;
    assert.ok(t.includes('M-11') && t.includes('Pryce lease dispute') && t.includes('2026-05-12 11:00'));
    assert.ok(!/<(textarea|button|input|form)\b/i.test(t));
    const p0 = t.indexOf('Transcript parent JUDGE-T0'), p1 = t.indexOf('Transcript child JUDGE-T1');
    assert.ok(p0 > 0 && p1 > p0);
    const row = s => t.slice(t.lastIndexOf('<li', t.indexOf(s)), t.indexOf(s));
    assert.match(row('Transcript child JUDGE-T1'), /--depth:\s*1/);
    assert.match(row('Transcript parent JUDGE-T0'), /Harriet/);
    const k2 = t.slice(t.lastIndexOf('<li', t.indexOf('Landlord&#39;s notice')), t.indexOf('Landlord&#39;s notice') + 600);
    assert.ok(k2.includes('On hold') && /edited/.test(k2) && t.includes('Landlords notice recieved.'), 'held edited versions');
  });

  // Persistence setup, before the restart.
  await home(harriet); await openMatter(harriet, 'M-11');
  await post(harriet, 'Persist parent JUDGE-S0');
  await reply(harriet, 'Persist parent JUDGE-S0', 'Persist child JUDGE-S1');
  await msgLi(harriet, 'Persist parent JUDGE-S0').locator('button', { hasText: 'Edit' }).click();
  await harriet.fill('#composer-input', 'Persist parent JUDGE-S0 edited'); await harriet.click('#composer-send');
  await harriet.waitForFunction(() => document.querySelector('#thread').textContent.includes('JUDGE-S0 edited'));
  await msgLi(harriet, 'Persist child JUDGE-S1').locator('button', { hasText: 'Place hold' }).click();
  await harriet.waitForFunction(() => [...document.querySelectorAll('#thread li.message')].some(l => l.querySelector('.body')?.textContent.includes('JUDGE-S1') && l.querySelector('.hold-badge')));
  await post(harriet, 'Persist gone JUDGE-S2'); await del(harriet, 'Persist gone JUDGE-S2');
  await openMatter(harriet, 'M-12'); await setTimer(harriet, '30');
  await openMatter(harriet, 'M-11');
  await harriet.selectOption('#wall-select', 'sian@kittle.test'); await harriet.click('#wall-add');
  await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Sian'));
  await home(dev);
  const baseline = { survey: (await search(harriet, 'Survey booked')).length, probate: (await search(harriet, 'Probate')).length, insurer: (await search(harriet, 'Insurer letter')).length };
  fs.writeFileSync(STATE, JSON.stringify({ devUnread13: await unreadOf(dev, 'M-13'), baseline }));
}

async function after() {
  const note = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const harriet = await ctx(); const dev = await ctx(); const sian = await ctx();
  await check('persistence', async () => {
    await signIn(harriet, 'harriet@kittle.test'); await signIn(dev, 'dev@kittle.test'); await signIn(sian, 'sian@kittle.test');
    await openMatter(harriet, 'M-11');
    assert.equal(await depthOf(harriet, 'Persist child JUDGE-S1'), 1);
    assert.equal(await msgLi(harriet, 'Persist child JUDGE-S1').locator('.hold-badge').count(), 1);
    assert.equal(await msgLi(harriet, 'JUDGE-S0 edited').locator('.edited').count(), 1);
    await msgLi(harriet, 'JUDGE-S0 edited').locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Persist parent JUDGE-S0'));
    assert.ok(!(await harriet.locator('#thread').innerText()).includes('Persist gone'));
    await openMatter(harriet, 'M-12');
    assert.ok((await harriet.locator('#matter-timer').innerText()).includes('30 days'));
    assert.equal((await api(sian, 'GET', '/api/matters/M-11')).status, 404);
    assert.equal((await api(dev, 'GET', '/api/matters/M-12')).status, 404);
    assert.equal(await unreadOf(dev, 'M-13'), note.devUnread13);
    assert.ok((await search(harriet, 'Persist child JUDGE-S1')).some(t => t.includes('Persist child JUDGE-S1')));
    assert.deepEqual(await search(harriet, 'Persist gone'), []);
    const now = { survey: (await search(harriet, 'Survey booked')).length, probate: (await search(harriet, 'Probate')).length, insurer: (await search(harriet, 'Insurer letter')).length };
    assert.deepEqual(now, note.baseline);
    await home(harriet); await openMatter(harriet, 'M-11');
    await harriet.locator('#wall-list button', { hasText: 'Lift wall' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#wall-list').textContent.includes('Sian'));
    await openMatter(harriet, 'M-12'); await setTimer(harriet, 'off');
  });
  await check('polish_transcript_phone', async () => {
    const p = await ctx(); await p.setViewportSize({ width: 390, height: 844 });
    await signIn(p, 'gwen@kittle.test');
    await p.goto(B + '/transcripts/M-11');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
    await p.context().close();
  });
  await check('polish_refusal_in_place', async () => {
    const p = await ctx(); await p.goto(B + '/'); await p.waitForSelector('#email');
    await p.fill('#email', 'gwen@kittle.test'); await p.fill('#password', 'wrong'); await p.click('#signin-form button[type=submit]');
    await p.waitForSelector('#signin-error:not([hidden])');
    await sleep(10000);
    assert.ok((await p.locator('#signin-error').innerText()).trim().length > 0);
    await p.fill('#password', 'password123'); await p.click('#signin-form button[type=submit]');
    await p.waitForSelector('#app:not([hidden]) .matter-link');
  });
}

(async () => {
  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  if (phase === 'before') await before(); else await after();
  fs.writeFileSync(`/state/functional-${phase}.json`, JSON.stringify({ results, dialogs }, null, 2));
  await browser.close();
  process.exit(Object.values(results).every(v => v === true) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
