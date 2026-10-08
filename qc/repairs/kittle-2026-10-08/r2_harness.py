"""Bring the scripted golden harness in line with the round r2 criteria fixes."""
p = 'tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# wall_added_live: record a real add and lift on Dev, then Sian replays the lift for herself.
r("""    await openMatter(harriet, 'M-13'); harriet.requests.length = 0;
    await harriet.selectOption('#wall-select', 'sian@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Sian'));
    const wreq = lastReq(harriet, 'POST', /\\/walls$/);
""", """    await openMatter(harriet, 'M-13'); harriet.requests.length = 0;
    await harriet.selectOption('#wall-select', 'dev@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Dev'));
    await harriet.locator('#wall-list button', { hasText: 'Lift wall' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#wall-list').textContent.includes('Dev'));
    const liftReq = lastReq(harriet, 'POST', /\\/walls$/);
    await harriet.selectOption('#wall-select', 'sian@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Sian'));
""")
r("""    const lift = { ...wreq, body: JSON.stringify({ ...JSON.parse(wreq.body), walled: false }) };
""", """    const lift = { ...liftReq, body: liftReq.body.replace('dev@kittle.test', 'sian@kittle.test') };
    assert.equal(JSON.parse(liftReq.body).email, 'dev@kittle.test');
""")

# timer_changes: record the versions request and replay it after the shortening.
r("""    await msgLi(harriet, 'Probate estimate').locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Probate estimate is 2,400 pounds.'));
""", """    harriet.requests.length = 0;
    await msgLi(harriet, 'Probate estimate').locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Probate estimate is 2,400 pounds.'));
    const vreq = lastReq(harriet, 'GET', /\\/versions$/);
""")
r("""    for (const q of ['Probate', '2,400', '4,200']) assert.deepEqual(await search(harriet, q), []);
""", """    const vr = await replay(harriet, vreq);
    assert.equal(vr.status, 404); assert.ok(!/2,400|4,200/.test(JSON.stringify(vr.data)));
    for (const q of ['Probate', '2,400', '4,200']) assert.deepEqual(await search(harriet, q), []);
""")

# hold_scope_and_release: Sian replays Harriet's recorded release against JUDGE-H1.
r("""    await msgLi(harriet, 'Insurer letter acknowledged.').locator('button', { hasText: 'Release hold' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#thread').textContent.includes('Insurer letter'));
    assert.deepEqual(await search(harriet, 'Insurer letter'), []);
""", """    harriet.requests.length = 0;
    await msgLi(harriet, 'Insurer letter acknowledged.').locator('button', { hasText: 'Release hold' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#thread').textContent.includes('Insurer letter'));
    const rreq = lastReq(harriet, 'POST', /\\/hold$/);
    assert.deepEqual(await search(harriet, 'Insurer letter'), []);
    assert.equal((await replay(sian, { ...rreq, url: rreq.url.replace(/K-\\d+(?=\\/hold$)/, h1) })).status, 403);
    assert.equal((await api(harriet, 'GET', '/api/matters/M-11')).data.messages.find(m => m.id === h1).hold, true);
""")

# sent_once_in_order Part B: C, A, B order and the firm's fixed sent time.
r("""    for (const k of ['A', 'B', 'C']) await post(harriet, `Order ${k} JUDGE-O`);""",
  """    for (const k of ['C', 'A', 'B']) await post(harriet, `Order ${k} JUDGE-O`);""")
r("""    assert.equal(await order(harriet), 'ABC');
    await home(gwen); await openMatter(gwen, 'M-11'); assert.equal(await order(gwen), 'ABC');
    assert.equal((await search(gwen, 'JUDGE-O')).map(s => s.match(/Order (\\w)/)[1]).join(''), 'ABC');
    const t = (await transcript(gwen, 'M-11')).html;
    assert.ok(t.indexOf('Order A') < t.indexOf('Order B') && t.indexOf('Order B') < t.indexOf('Order C'));""",
  """    assert.equal(await order(harriet), 'CAB');
    for (const k of ['A', 'B', 'C']) assert.ok((await msgLi(harriet, `Order ${k} JUDGE-O`).locator('time').innerText()).includes('2026-05-12 11:00'));
    await home(gwen); await openMatter(gwen, 'M-11'); assert.equal(await order(gwen), 'CAB');
    assert.equal((await search(gwen, 'JUDGE-O')).map(s => s.match(/Order (\\w)/)[1]).join(''), 'CAB');
    const t = (await transcript(gwen, 'M-11')).html;
    assert.ok(t.indexOf('Order C') < t.indexOf('Order A') && t.indexOf('Order A') < t.indexOf('Order B'));
    const oc = t.slice(t.lastIndexOf('<li', t.indexOf('Order C')), t.indexOf('Order C'));
    assert.ok(oc.includes('2026-05-12 11:00'), 'transcript sent time');""")

# persistence: note a search baseline before the restart and compare after it.
r("""  await home(dev);
  fs.writeFileSync(STATE, JSON.stringify({ devUnread13: await unreadOf(dev, 'M-13') }));""",
  """  await home(dev);
  const baseline = { survey: (await search(harriet, 'Survey booked')).length, probate: (await search(harriet, 'Probate')).length, insurer: (await search(harriet, 'Insurer letter')).length };
  fs.writeFileSync(STATE, JSON.stringify({ devUnread13: await unreadOf(dev, 'M-13'), baseline }));""")
r("""    for (const q of ['Persist gone', 'Probate', 'Insurer letter', 'Boundary note', 'Temp JUDGE-P2']) assert.deepEqual(await search(harriet, q), [], q);
    assert.equal((await api(harriet, 'GET', '/api/matters/M-11')).data.messages.filter(m => m.body === 'Survey booked for Friday.').length, 1);""",
  """    assert.ok((await search(harriet, 'Persist child JUDGE-S1')).some(t => t.includes('Persist child JUDGE-S1')));
    assert.deepEqual(await search(harriet, 'Persist gone'), []);
    const now = { survey: (await search(harriet, 'Survey booked')).length, probate: (await search(harriet, 'Probate')).length, insurer: (await search(harriet, 'Insurer letter')).length };
    assert.deepEqual(now, note.baseline);""")

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
