"""Bring the scripted golden harness in line with the r5 criteria fixes (run from qc/repairs/kittle-2026-10-08)."""
p = 'tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# wall_every_route leg 5: a parent from M-13, which Dev can see, is refused too.
r("""    for (const [pg, id] of [[dev, 'M-11'], [harriet, 'M-11'], [sian, 'M-12']]) assert.ok(!JSON.stringify((await api(pg, 'GET', `/api/matters/${id}`)).data).includes('JUDGE-W2'), id);
""", """    for (const [pg, id] of [[dev, 'M-11'], [harriet, 'M-11'], [sian, 'M-12']]) assert.ok(!JSON.stringify((await api(pg, 'GET', `/api/matters/${id}`)).data).includes('JUDGE-W2'), id);
    dev.requests.length = 0; await openMatter(dev, 'M-13');
    const d13 = lastReq(dev, 'GET', /\\/api\\/matters\\/M-13$/);
    const k8 = (await replay(dev, d13)).data.messages.find(m => m.body === 'Draft will sent for your review.').id;
    const cross2 = { ...cross, body: 'Cross reply JUDGE-W3', parent_id: k8, client_key: 'w3' };
    const c2 = await replay(dev, { ...rreq, body: JSON.stringify(cross2) });
    assert.ok(c2.status === 404 && c2.data.error === 'Not available.', JSON.stringify(c2));
    for (const id of ['M-11', 'M-13']) assert.ok(!JSON.stringify((await api(dev, 'GET', `/api/matters/${id}`)).data).includes('JUDGE-W3'), id);
""")

# timer_changes: off reads off, 30 days brings nothing back, Sian opens M-13 first.
r("""    await setTimer(harriet, 'off');
    assert.ok(!(await harriet.locator('#thread').innerText()).includes('Probate'));
    await setTimer(harriet, '30');
    await home(sian);""", """    await setTimer(harriet, 'off');
    assert.ok(/off/i.test(await harriet.locator('#matter-timer').innerText()));
    assert.ok(!(await harriet.locator('#thread').innerText()).includes('Probate'));
    await setTimer(harriet, '30');
    assert.ok(!(await harriet.locator('#thread').innerText()).includes('Probate'));
    await home(sian); await openMatter(sian, 'M-13');""")

# edits Part A leg 3: Sian opens M-13 and replays with the current version.
r("""    await home(sian);
    assert.equal((await replay(sian, { ...ereq, body: JSON.stringify({ ...JSON.parse(ereq.body), body: 'Hijack JUDGE-E1' }) })).status, 403);""",
  """    await home(sian); sian.requests.length = 0; await openMatter(sian, 'M-13');
    const s13 = lastReq(sian, 'GET', /\\/api\\/matters\\/M-13$/);
    const e1 = (await replay(sian, s13)).data.messages.find(m => m.body === 'Version two JUDGE-E1');
    assert.equal((await replay(sian, { ...ereq, body: JSON.stringify({ ...JSON.parse(ereq.body), body: 'Hijack JUDGE-E1', version: e1.version }) })).status, 403);""")

# search_and_transcript: a seeded message keeps its own sent time; * literal; part of a word.
r("""    assert.match(row('Transcript parent JUDGE-T0'), /Harriet/);""",
  """    assert.match(row('Transcript parent JUDGE-T0'), /Harriet/);
    assert.match(row('Survey booked for Friday.'), /2026-05-08 15:00/);""")
r("""    assert.equal(await tags('1000 pounds'), 'JUDGE-Q2');""",
  """    for (const m of ['Code X*9 JUDGE-Q5', 'Code XY9 JUDGE-Q6']) await post(gwen, m);
    assert.equal(await tags('1000 pounds'), 'JUDGE-Q2');
    assert.equal((await search(gwen, 'X*9')).map(x => (x.match(/JUDGE-Q\\d/) || [''])[0]).join(','), 'JUDGE-Q5');
    assert.ok((await search(gwen, 'urvey booked')).some(t => t.includes('Survey booked for Friday.')));""")

# persistence: every step c positive control holds before the restart.
r("""  await home(dev);
  const baseline = {""", """  await check('persistence_before', async () => {
    await home(harriet); await openMatter(harriet, 'M-11');
    assert.equal(await depthOf(harriet, 'Persist child JUDGE-S1'), 1);
    assert.equal(await msgLi(harriet, 'JUDGE-S0 edited').locator('.edited').count(), 1);
    await msgLi(harriet, 'JUDGE-S0 edited').locator('button', { hasText: 'Versions' }).click();
    await harriet.waitForSelector('.versions');
    assert.ok((await harriet.locator('.versions').innerText()).includes('Persist parent JUDGE-S0'));
    assert.equal(await msgLi(harriet, 'Persist child JUDGE-S1').locator('.hold-badge').count(), 1);
    assert.ok(!(await harriet.locator('#thread').innerText()).includes('Persist gone'));
    await openMatter(harriet, 'M-12');
    assert.ok((await harriet.locator('#matter-timer').innerText()).includes('30 days'));
    assert.equal((await api(sian, 'GET', '/api/matters/M-11')).status, 404);
    assert.equal((await api(dev, 'GET', '/api/matters/M-12')).status, 404);
    assert.deepEqual(await search(harriet, 'Persist gone'), []);
    assert.ok((await search(harriet, 'Persist child JUDGE-S1')).some(t => t.includes('Persist child JUDGE-S1')));
    assert.ok((await search(harriet, 'Survey booked')).some(t => t.includes('Survey booked for Friday.')));
  });
  await home(dev);
  const baseline = {""")

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
