// Scripted golden checks for Kittle's 22 functional criteria, run in order on one
// database like the judge does. Phase "before" runs everything up to the restart and
// saves what persistence must find; phase "after" re-reads it after a real restart.
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
async function reply(page, parentText, text) {
  await msgLi(page, parentText).locator('button', { hasText: /^Reply$/ }).click();
  await post(page, text);
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
const depthOf = (page, text) => msgLi(page, text).evaluate(el => Number(getComputedStyle(el).getPropertyValue('--depth') || el.style.getPropertyValue('--depth')));
const threadTexts = page => page.locator('#thread li').evaluateAll(els => els.map(e => e.className + '|' + e.textContent));
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

  await check('signin_and_signed_out', async () => {
    await signIn(gwen, 'gwen@kittle.test');
    const titles = await gwen.locator('.matter-link').allTextContents();
    assert.ok(titles.some(t => t.includes('Pryce lease dispute')) && titles.some(t => t.includes('Pryce will')));
    assert.ok(!titles.some(t => t.includes('Marsh')));
    gwen.requests.length = 0;
    await openMatter(gwen, 'M-11');
    const load = gwen.requests.find(r => r.method === 'GET' && /\/api\/matters\/M-11$/.test(r.url));
    assert.ok(load, 'recorded matter load');
    await gwen.click('#signout'); await gwen.waitForSelector('#signin:not([hidden])');
    assert.ok(!(await gwen.locator('body').innerText()).includes('Pryce'));
    const r = await replay(gwen, load);
    assert.equal(r.status, 401); assert.ok(!JSON.stringify(r.data).includes('Pryce'));
    await gwen.fill('#email', 'harriet@kittle.test'); await gwen.fill('#password', 'wrong'); await gwen.click('#signin-form button[type=submit]');
    await gwen.waitForSelector('#signin-error:not([hidden])');
    await signIn(gwen, 'gwen@kittle.test');
  });

  await check('client_scope', async () => {
    await openMatter(gwen, 'M-11'); gwen.requests.length = 0;
    await post(gwen, 'Lease question JUDGE-CS1');
    const req = gwen.requests.find(r => r.method === 'POST' && /\/api\/matters\/M-11\/messages$/.test(r.url));
    const r1 = await replay(gwen, { ...req, url: req.url.replace('M-11', 'M-12') });
    assert.equal(r1.status, 404);
    const r2 = await api(gwen, 'GET', '/api/matters/M-12'); assert.equal(r2.status, 404);
    await signIn(harriet, 'harriet@kittle.test');
    const m12 = await api(harriet, 'GET', '/api/matters/M-12');
    assert.ok(!JSON.stringify(m12.data).includes('JUDGE-CS1'));
  });

  await check('wall_every_route', async () => {
    await signIn(sian, 'sian@kittle.test'); await openMatter(sian, 'M-12');
    assert.ok((await sian.locator('#thread').innerText()).includes('heads of terms'));
    assert.ok((await search(sian, 'heads of terms')).some(t => t.includes('Draft heads of terms')));
    await signIn(dev, 'dev@kittle.test');
    const list = (await dev.locator('#matter-list').innerText());
    assert.ok(!list.includes('M-12') && !list.includes('Marsh'));
    for (const q of ['heads of terms', 'Fenwick', 'Schedule 4']) assert.deepEqual(await search(dev, q), []);
    assert.equal((await api(dev, 'GET', '/api/matters/M-12')).status, 404);
    assert.equal((await api(dev, 'GET', '/api/search?q=terms')).data.results.filter(x => x.matter_id === 'M-12').length, 0);
    const t = await transcript(dev, 'M-12'); assert.equal(t.status, 404); assert.ok(!t.html.includes('Marsh'));
    await dev.goto(B + '/transcripts/M-12'); assert.ok((await dev.locator('body').innerText()).includes('Not available'));
    await dev.goto(B + '/');
    await dev.waitForSelector('.matter-link');
  });

  await check('wall_mentions_and_links', async () => {
    await openMatter(harriet, 'M-12');
    const link = await copyLink(harriet, 'Draft heads of terms ready for comment.');
    assert.ok(/\/messages\/K-6$/.test(link), link);
    await post(harriet, '@Dev please review JUDGE-M1');
    await openMatter(harriet, 'M-11');
    await post(harriet, 'See the M-12 terms JUDGE-L1 ' + link);
    assert.ok((await msgLi(harriet, 'JUDGE-L1').locator('.preview').innerText()).includes('heads of terms'));
    await post(harriet, '@Dev survey update JUDGE-M2');
    await dev.reload(); await dev.waitForSelector('.matter-link'); await openMatter(dev, 'M-11');
    const pv = await msgLi(dev, 'JUDGE-L1').locator('.preview').innerText();
    assert.ok(/not available/i.test(pv) && !pv.includes('heads') && !pv.includes('Marsh'), pv);
    await dev.goto(link); await sleep(800);
    const body = await dev.locator('#main').innerText();
    assert.ok(/not available/i.test(body) && !body.includes('heads of terms'), body.slice(0, 200));
    const m = await api(dev, 'GET', '/api/mentions');
    const texts = JSON.stringify(m.data);
    assert.ok(texts.includes('JUDGE-M2') && !texts.includes('JUDGE-M1') && !texts.includes('M-12'), texts);
    await dev.goto(B + '/'); await dev.waitForSelector('.matter-link');
  });

  await check('wall_added_live', async () => {
    await openMatter(sian, 'M-13'); sian.requests.length = 0;
    await post(sian, 'Before wall JUDGE-WL0');
    const req = sian.requests.find(r => r.method === 'POST' && /\/messages$/.test(r.url));
    await openMatter(harriet, 'M-13');
    await harriet.selectOption('#wall-select', 'sian@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Sian'));
    await sian.waitForFunction(() => !document.querySelector('#matter-list').textContent.includes('M-13') && /Not available/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const r = await replay(sian, { ...req, body: JSON.stringify({ body: 'Too late JUDGE-WL1', client_key: 'wl1' }) });
    assert.equal(r.status, 404);
    assert.ok(!JSON.stringify((await api(harriet, 'GET', '/api/matters/M-13')).data).includes('JUDGE-WL1'));
    await harriet.locator('#wall-list button', { hasText: 'Lift wall' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#wall-list').textContent.includes('Sian'));
    await sian.reload(); await sian.waitForSelector('.matter-link');
    assert.ok((await sian.locator('#matter-list').innerText()).includes('M-13'));
  });

  await check('nested_replies', async () => {
    await openMatter(harriet, 'M-13');
    await post(harriet, 'Root question JUDGE-R0');
    await reply(harriet, 'JUDGE-R0', 'Level one JUDGE-R1');
    await reply(harriet, 'Level one JUDGE-R1', 'Level two JUDGE-R2');
    await reply(harriet, 'Level two JUDGE-R2', 'Level three JUDGE-R3');
    await post(harriet, 'Unrelated JUDGE-RX');
    await reply(harriet, 'Root question JUDGE-R0', 'Another level one JUDGE-R1B');
    for (const p of [harriet]) {
      assert.deepEqual([await depthOf(p, 'Level one JUDGE-R1'), await depthOf(p, 'Level two JUDGE-R2'), await depthOf(p, 'Level three JUDGE-R3'), await depthOf(p, 'Another level one JUDGE-R1B')], [1, 2, 3, 1]);
      const order = (await p.locator('#thread li.message .body').allTextContents()).map(t => (t.match(/JUDGE-R\w+/) || [])[0]).filter(Boolean);
      const idx = k => order.lastIndexOf(k);
      assert.ok(idx('JUDGE-R3') < idx('JUDGE-R1B') && idx('JUDGE-R1B') < idx('JUDGE-RX'), order.join(','));
      assert.ok((await msgLi(p, 'Level two JUDGE-R2').locator('.quote').innerText()).includes('Level one JUDGE-R1'));
    }
    await openMatter(gwen, 'M-13');
    assert.equal(await depthOf(gwen, 'Level three JUDGE-R3'), 3);
  });

  await check('deleted_parent_placeholder', async () => {
    await openMatter(gwen, 'M-11');
    const html = (await gwen.locator('#thread').innerText());
    assert.ok(/Original message deleted/.test(html) && !html.includes('original lease scan'));
    assert.ok((await msgLi(gwen, 'Clause 14 noted').locator('.quote').innerText()).match(/deleted/i));
    assert.equal(await depthOf(gwen, 'Thank you, the deadline'), 2);
    assert.deepEqual(await search(gwen, 'original lease scan'), []);
    assert.equal((await search(gwen, 'Clause 14 noted')).length, 1);
    const t = await transcript(gwen, 'M-11');
    assert.ok(t.html.includes('Original message deleted') && !t.html.includes('original lease scan') && t.html.includes('Clause 14 noted'));
    await gwen.goto(B + '/'); await gwen.waitForSelector('.matter-link');
  });

  await check('timer_boundary', async () => {
    await openMatter(harriet, 'M-11');
    const text = await harriet.locator('#thread').innerText();
    assert.ok(!text.includes('Boundary note') && text.includes('Rent review meeting moved'));
    assert.deepEqual(await search(harriet, 'rent review date'), []);
    assert.ok(!(await transcript(harriet, 'M-11')).html.includes('Boundary note'));
  });

  await check('timer_changes', async () => {
    await openMatter(harriet, 'M-13');
    let text = await harriet.locator('#thread').innerText();
    assert.ok(text.includes('Probate estimate is 4,200 pounds.') && text.includes('My executor will be my sister.'));
    harriet.requests.length = 0;
    await harriet.selectOption('#timer-select', '7'); await harriet.click('#timer-form button');
    await harriet.waitForFunction(() => document.querySelector('#matter-timer').textContent.includes('7 days'));
    const req = harriet.requests.find(r => r.method === 'POST' && /\/timer$/.test(r.url));
    await openMatter(sian, 'M-13');
    const r = await replay(sian, { ...req, body: JSON.stringify({ days: 1 }) });
    assert.equal(r.status, 403);
    await sleep(500);
    text = await harriet.locator('#thread').innerText();
    assert.ok(!text.includes('Probate estimate'), 'probate gone');
    assert.ok(text.includes('My executor will be my sister.') && (await msgLi(harriet, 'My executor').locator('.hold-badge').count()) === 1);
    await harriet.selectOption('#timer-select', 'off'); await harriet.click('#timer-form button');
    await harriet.waitForFunction(() => document.querySelector('#matter-timer').textContent.includes('off'));
    assert.ok(!(await harriet.locator('#thread').innerText()).includes('Probate'));
    assert.deepEqual(await search(harriet, 'Probate estimate'), []);
    await openMatter(harriet, 'M-13');
    await harriet.selectOption('#timer-select', '30'); await harriet.click('#timer-form button');
    await harriet.waitForFunction(() => document.querySelector('#matter-timer').textContent.includes('30 days'));
  });

  await check('deleted_message_takes_its_versions', async () => {
    for (const q of ['Probate', '2,400', '4,200']) assert.deepEqual(await search(harriet, q), []);
    const t = await transcript(harriet, 'M-13'); assert.ok(!t.html.includes('2,400') && !t.html.includes('4,200'));
    await openMatter(harriet, 'M-11');
    await msgLi(harriet, "Landlord's notice received and filed.").locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Landlords notice recieved.'));
  });

  await check('hold_scope_and_release', async () => {
    await openMatter(harriet, 'M-11');
    await post(harriet, 'Hold parent JUDGE-H0');
    await reply(harriet, 'Hold parent JUDGE-H0', 'Hold child JUDGE-H1');
    await msgLi(harriet, 'Hold child JUDGE-H1').locator('button', { hasText: 'Place hold' }).click();
    await harriet.waitForFunction(() => [...document.querySelectorAll('#thread li.message')].some(l => l.textContent.includes('JUDGE-H1') && l.querySelector('.hold-badge')));
    harriet.requests.length = 0;
    await msgLi(harriet, 'Hold child JUDGE-H1').locator('button', { hasText: 'Delete' }).click();
    await harriet.waitForFunction(() => [...document.querySelectorAll('#thread li.message')].some(l => l.textContent.includes('JUDGE-H1') && l.querySelector('.action-error:not([hidden])')));
    const del = harriet.requests.find(r => r.method === 'DELETE');
    assert.equal((await replay(harriet, del)).status, 409);
    await post(harriet, 'Not really On hold JUDGE-H2');
    assert.equal(await msgLi(harriet, 'JUDGE-H2').locator('.hold-badge').count(), 0);
    await openMatter(gwen, 'M-11');
    assert.equal(await msgLi(gwen, 'Hold child JUDGE-H1').locator('.hold-badge').count(), 1);
    assert.equal(await msgLi(gwen, 'Hold parent JUDGE-H0').locator('.hold-badge').count(), 0);
    await msgLi(harriet, 'Insurer letter acknowledged.').locator('button', { hasText: 'Release hold' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#thread').textContent.includes('Insurer letter'));
    assert.deepEqual(await search(harriet, 'Insurer letter'), []);
  });

  await check('edits_and_stale_edit', async () => {
    await openMatter(gwen, 'M-13');
    await post(gwen, 'Version one JUDGE-E1');
    const gwen2 = await ctx(); await signIn(gwen2, 'gwen@kittle.test'); await openMatter(gwen2, 'M-13');
    await msgLi(gwen2, 'Version one JUDGE-E1').locator('button', { hasText: 'Edit' }).click();
    assert.equal(await gwen2.inputValue('#composer-input'), 'Version one JUDGE-E1');
    await msgLi(gwen, 'Version one JUDGE-E1').locator('button', { hasText: 'Edit' }).click();
    await gwen.fill('#composer-input', 'Version two JUDGE-E1'); await gwen.click('#composer-send');
    await gwen.waitForFunction(() => [...document.querySelectorAll('#thread li.message')].some(l => l.textContent.includes('Version two JUDGE-E1') && l.querySelector('.edited')));
    await openMatter(harriet, 'M-13');
    await msgLi(harriet, 'Version two JUDGE-E1').locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Version one JUDGE-E1'));
    await gwen2.fill('#composer-input', 'Version stale JUDGE-E1'); await gwen2.click('#composer-send');
    await gwen2.waitForSelector('#composer-error:not([hidden])');
    assert.equal(await gwen2.inputValue('#composer-input'), 'Version stale JUDGE-E1');
    await gwen2.reload(); await gwen2.waitForSelector('.matter-link'); await openMatter(gwen2, 'M-13');
    const text = await gwen2.locator('#thread').innerText();
    assert.ok(text.includes('Version two JUDGE-E1') && !text.includes('Version stale'));
    await gwen2.context().close();
  });

  await check('safe_formatting', async () => {
    await openMatter(gwen, 'M-13');
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
    const snippets = await search(gwen, 'JUDGE-F1');
    assert.ok(snippets.some(s => s.includes('<script>alert(8)</script>')));
    assert.equal(await gwen.locator('#results img, #results script').count(), 0);
    const t = await transcript(gwen, 'M-13'); assert.ok(t.html.includes('&lt;img src=x') && !t.html.includes('<img src=x'));
    await openMatter(gwen, 'M-11');
    const k16 = msgLi(gwen, 'Pasted from the lease');
    assert.ok((await k16.locator('.body').innerText()).includes('<b>Schedule 2</b>'));
    assert.equal(await k16.locator('.hold-badge').count(), 0);
    assert.equal(await k16.locator('a').count(), 0);
    assert.deepEqual(dialogs, []);
  });

  await check('message_links', async () => {
    await openMatter(harriet, 'M-13');
    const link = await copyLink(harriet, 'Draft will sent for your review.');
    await openMatter(harriet, 'M-11');
    await post(harriet, 'See draft JUDGE-P1 ' + link);
    assert.ok((await msgLi(harriet, 'JUDGE-P1').locator('.preview').innerText()).includes('Draft will sent'));
    await openMatter(gwen, 'M-11');
    await msgLi(gwen, 'JUDGE-P1').locator('.preview a').click();
    await gwen.waitForFunction(() => location.pathname === '/matters/M-13' && document.querySelector('#msg-K-8.focused'));
    await openMatter(harriet, 'M-13');
    await post(harriet, 'Temp JUDGE-P2');
    const link2 = await copyLink(harriet, 'Temp JUDGE-P2');
    await openMatter(harriet, 'M-11');
    await post(harriet, 'Gone soon JUDGE-P3 ' + link2);
    assert.ok((await msgLi(harriet, 'JUDGE-P3').locator('.preview').innerText()).includes('Temp JUDGE-P2'));
    await openMatter(harriet, 'M-13');
    await msgLi(harriet, 'Temp JUDGE-P2').locator('button', { hasText: 'Delete' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#thread').textContent.includes('Temp JUDGE-P2'));
    await openMatter(harriet, 'M-11');
    const pv = await msgLi(harriet, 'JUDGE-P3').locator('.preview').innerText();
    assert.ok(/not available/i.test(pv) && !pv.includes('Temp'), pv);
  });

  await check('unread_and_new_messages_line', async () => {
    const devB = await ctx(); await signIn(devB, 'dev@kittle.test');
    await dev.goto(B + '/'); await dev.waitForSelector('.matter-link');
    await openMatter(dev, 'M-13'); await openMatter(dev, 'M-11');
    await dev.waitForFunction(() => !document.querySelector('.matter-link[href="/matters/M-13"] .badge'), null, { timeout: 10000 });
    const start = await unreadOf(dev, 'M-13');
    const gStart = await unreadOf(gwen, 'M-13');
    await api(harriet, 'POST', '/api/matters/M-13/messages', { body: 'Unread one JUDGE-U1', client_key: 'u1' });
    await api(harriet, 'POST', '/api/matters/M-13/messages', { body: 'Unread two JUDGE-U2', client_key: 'u2' });
    for (const p of [dev, devB]) await p.waitForFunction(n => Number(document.querySelector('.matter-link[href="/matters/M-13"] .badge')?.textContent || 0) === n, start + 2, { timeout: 10000 });
    await openMatter(dev, 'M-13');
    const items = await threadTexts(dev);
    const line = items.findIndex(t => t.startsWith('new-line'));
    assert.ok(line >= 0 && items[line + 1].includes('JUDGE-U1'), 'line above U1');
    for (const p of [dev, devB]) await p.waitForFunction(() => !document.querySelector('.matter-link[href="/matters/M-13"] .badge'), null, { timeout: 10000 });
    await msgLi(dev, 'Unread two JUDGE-U2').locator('button', { hasText: 'Mark unread' }).click();
    await dev.waitForFunction(() => document.querySelector('.matter-link[href="/matters/M-13"] .badge')?.textContent === '1', null, { timeout: 10000 });
    await dev.goto(B + '/'); await dev.waitForSelector('.matter-link'); await openMatter(dev, 'M-13');
    const items2 = await threadTexts(dev);
    const line2 = items2.findIndex(t => t.startsWith('new-line'));
    assert.ok(line2 >= 0 && items2[line2 + 1].includes('JUDGE-U2'), 'line above U2');
    assert.ok(!(await dev.locator('#matter-list').innerText()).includes('M-12'));
    await gwen.goto(B + '/'); await gwen.waitForSelector('.matter-link');
    assert.ok((await unreadOf(gwen, 'M-13')) >= 2, 'gwen count is her own');
    await devB.context().close();
  });

  await check('no_duplicate_send', async () => {
    await openMatter(sian, 'M-11'); sian.requests.length = 0;
    await post(sian, 'Sent once JUDGE-D1');
    const req = sian.requests.find(r => r.method === 'POST' && /\/messages$/.test(r.url));
    await replay(sian, req); await replay(sian, req);
    await sian.reload(); await sian.waitForSelector('.matter-link'); await openMatter(sian, 'M-11');
    assert.equal(await sian.locator('#thread li.message', { hasText: 'Sent once JUDGE-D1' }).count(), 1);
    assert.equal((await search(sian, 'JUDGE-D1')).length, 1);
    assert.equal((await transcript(sian, 'M-11')).html.split('Sent once JUDGE-D1').length - 1, 1);
    await openMatter(sian, 'M-11');
    await post(sian, 'Sent once JUDGE-D2');
    assert.equal(await sian.locator('#thread li.message', { hasText: 'JUDGE-D2' }).count(), 1);
  });

  await check('stable_order', async () => {
    await openMatter(harriet, 'M-11');
    for (const k of ['A', 'B', 'C']) await post(harriet, `Order ${k} JUDGE-O`);
    const order = async p => (await threadTexts(p)).map(t => (t.match(/Order ([ABC]) JUDGE-O/) || [])[1]).filter(Boolean).join('');
    assert.equal(await order(harriet), 'ABC');
    await openMatter(gwen, 'M-11'); assert.equal(await order(gwen), 'ABC');
    assert.equal((await search(gwen, 'JUDGE-O')).map(s => s.match(/Order (\w)/)[1]).join(''), 'ABC');
    const t = (await transcript(gwen, 'M-11')).html;
    assert.ok(t.indexOf('Order A') < t.indexOf('Order B') && t.indexOf('Order B') < t.indexOf('Order C'));
  });

  await check('live_updates_keep_my_work', async () => {
    await gwen.goto(B + '/'); await gwen.waitForSelector('.matter-link'); await openMatter(gwen, 'M-13');
    await msgLi(gwen, 'Draft will sent for your review.').locator('button', { hasText: /^Reply$/ }).click();
    await gwen.fill('#composer-input', 'Half typed JUDGE-LV');
    await gwen.evaluate(() => { const t = document.querySelector('#thread'); t.scrollTop = Math.max(0, t.scrollHeight / 3); });
    const top = await gwen.evaluate(() => document.querySelector('#thread').scrollTop);
    await api(harriet, 'POST', '/api/matters/M-13/messages', { body: 'Live arrival JUDGE-LA', client_key: 'la' });
    const r0 = (await api(harriet, 'GET', '/api/matters/M-13')).data.messages.find(m => m.body.includes('Root question JUDGE-R0'));
    await api(harriet, 'PATCH', '/api/messages/' + r0.id, { body: 'Root question JUDGE-R0 JUDGE-LE', version: r0.version });
    await gwen.waitForFunction(() => { const t = document.querySelector('#thread').textContent; return t.includes('JUDGE-LA') && t.includes('JUDGE-LE'); }, null, { timeout: 10000 });
    assert.equal(await gwen.inputValue('#composer-input'), 'Half typed JUDGE-LV');
    assert.ok((await gwen.locator('#composer-context').innerText()).includes('Draft will sent'));
    const top2 = await gwen.evaluate(() => document.querySelector('#thread').scrollTop);
    assert.ok(Math.abs(top2 - top) < 40, `scroll ${top} -> ${top2}`);
    await gwen.click('#composer-cancel');
  });

  await check('search_behaviour', async () => {
    const res = await search(gwen, 'survey BOOKED');
    assert.ok(res.some(t => t.includes('Survey booked for Friday.')));
    await gwen.locator('#results a', { hasText: 'Survey booked for Friday.' }).click();
    await gwen.waitForFunction(() => location.pathname === '/matters/M-11' && document.querySelector('#msg-K-3.focused'));
    assert.deepEqual(await search(gwen, 'Version one JUDGE-E1'), []);
    assert.equal((await search(gwen, 'Version two JUDGE-E1')).length, 1);
    assert.deepEqual(await search(gwen, 'heads of terms'), []);
  });

  await check('transcript_record', async () => {
    const t = (await transcript(harriet, 'M-11')).html;
    assert.ok(t.includes('M-11') && t.includes('Pryce lease dispute') && t.includes('2026-05-12 11:00'));
    assert.ok(!/<(textarea|button|input|form)\b/i.test(t));
    assert.ok(t.indexOf('Original message deleted') < t.indexOf('Clause 14 noted') && t.indexOf('Clause 14 noted') < t.indexOf('Thank you, the deadline'));
    const k2 = t.slice(t.indexOf("Landlord&#39;s notice") - 400, t.indexOf("Landlord&#39;s notice") + 600);
    assert.ok(k2.includes('On hold') && t.includes('Landlords notice recieved.'), 'versions');
    assert.ok(!t.includes('JUDGE-E1'));
    assert.equal((await transcript(dev, 'M-12')).status, 404);
    assert.equal((await transcript(dev, 'M-11')).status, 200);
  });

  // Persistence, before: note what must survive the restart.
  const note = {
    timer: (await api(harriet, 'GET', '/api/matters/M-13')).data.matter.timer_days,
    walls12: (await api(harriet, 'GET', '/api/matters/M-12')).data.walls,
    m13: (await api(harriet, 'GET', '/api/matters/M-13')).data.messages.map(m => [m.id, m.depth, m.body, m.hold, m.version]),
    m11: (await api(harriet, 'GET', '/api/matters/M-11')).data.messages.map(m => [m.id, m.depth, m.body, m.hold, m.version, m.deleted]),
    e1versions: null,
    devUnread13: (await api(dev, 'GET', '/api/matters')).data.matters.find(m => m.id === 'M-13').unread
  };
  const e1 = note.m13.find(m => String(m[2]).includes('Version two JUDGE-E1'));
  note.e1versions = (await api(harriet, 'GET', '/api/messages/' + e1[0] + '/versions')).data.versions.map(v => v.body);
  fs.writeFileSync(STATE, JSON.stringify(note));
}

async function after() {
  const note = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const harriet = await ctx(); const dev = await ctx();
  await check('persistence', async () => {
    await signIn(harriet, 'harriet@kittle.test'); await signIn(dev, 'dev@kittle.test');
    assert.equal((await api(harriet, 'GET', '/api/matters/M-13')).data.matter.timer_days, note.timer);
    assert.deepEqual((await api(harriet, 'GET', '/api/matters/M-12')).data.walls, note.walls12);
    assert.deepEqual((await api(harriet, 'GET', '/api/matters/M-13')).data.messages.map(m => [m.id, m.depth, m.body, m.hold, m.version]), note.m13);
    assert.deepEqual((await api(harriet, 'GET', '/api/matters/M-11')).data.messages.map(m => [m.id, m.depth, m.body, m.hold, m.version, m.deleted]), note.m11);
    const e1 = note.m13.find(m => String(m[2]).includes('Version two JUDGE-E1'));
    assert.deepEqual((await api(harriet, 'GET', '/api/messages/' + e1[0] + '/versions')).data.versions.map(v => v.body), note.e1versions);
    assert.equal((await api(dev, 'GET', '/api/matters')).data.matters.find(m => m.id === 'M-13').unread, note.devUnread13);
    assert.equal((await api(dev, 'GET', '/api/matters/M-12')).status, 404);
    const all = JSON.stringify((await api(harriet, 'GET', '/api/matters/M-11')).data);
    assert.ok(!all.includes('original lease scan'));
    assert.equal((await api(harriet, 'GET', '/api/matters/M-11')).data.messages.filter(m => m.body === 'Survey booked for Friday.').length, 1);
  });
}

(async () => {
  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  if (phase === 'before') await before(); else await after();
  fs.writeFileSync(`/state/functional-${phase}.json`, JSON.stringify({ results, dialogs }, null, 2));
  await browser.close();
  process.exit(Object.values(results).every(v => v === true) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
