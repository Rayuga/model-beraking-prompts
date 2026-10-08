"""Bring the scripted golden harness in line with the round r3 criteria fixes."""
p = 'tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# signin_and_client_scope: record messages, mentions and search requests plus the transcript address.
r("""    gwen.requests.length = 0;
    await openMatter(gwen, 'M-13');
    const load = lastReq(gwen, 'GET', /\\/api\\/matters\\/M-13$/);
    await gwen.click('#signout'); await gwen.waitForSelector('#signin:not([hidden])');
    assert.ok(!(await gwen.locator('body').innerText()).includes('Pryce'));
    const r = await replay(gwen, load);
    assert.equal(r.status, 401); assert.ok(!JSON.stringify(r.data).includes('Pryce'));
""", """    gwen.requests.length = 0;
    await openMatter(gwen, 'M-11');
    const load = lastReq(gwen, 'GET', /\\/api\\/matters\\/M-11$/);
    await gwen.click('#mentions-link'); await sleep(500);
    const mreq = lastReq(gwen, 'GET', /\\/api\\/mentions/);
    await search(gwen, 'Survey');
    const sreq = lastReq(gwen, 'GET', /\\/api\\/search/);
    const tOk = await gwen.request.get(`${B}/transcripts/M-11`); assert.equal(tOk.status(), 200);
    await home(gwen);
    await gwen.click('#signout'); await gwen.waitForSelector('#signin:not([hidden])');
    assert.ok(!(await gwen.locator('body').innerText()).includes('Pryce'));
    for (const q of [load, mreq, sreq]) {
      const r = await replay(gwen, q);
      assert.equal(r.status, 401); assert.ok(!/Pryce|Survey|Gwen|Harriet/.test(JSON.stringify(r.data)), q.url);
    }
    const tOut = await gwen.request.get(`${B}/transcripts/M-11`);
    assert.ok(tOut.status() >= 400 && !(await tOut.text()).includes('Survey booked'));
""")
r("""    assert.equal((await replay(gwen, { ...load, url: load.url.replace('M-13', 'M-12') })).status, 404);
""", """    assert.equal((await replay(gwen, { ...load, url: load.url.replace('M-11', 'M-12') })).status, 404);
    const gt = await gwen.request.get(`${B}/transcripts/M-12`); assert.equal(gt.status(), 404); assert.ok(!(await gt.text()).includes('Marsh'));
""")

# wall_every_route: Sian's transcript positive control.
r("""    const tr = { url: `${B}/transcripts/M-12`, method: 'GET' };
""", """    const tr = { url: `${B}/transcripts/M-12`, method: 'GET' };
    assert.ok((await (await sian.request.get(tr.url)).text()).includes('Wall check JUDGE-W0'));
""")

# wall_mentions_and_links: the typed text no longer names M-12.
r("""    await post(harriet, 'See the M-12 terms JUDGE-L1 ' + link);""",
  """    await post(harriet, 'See the linked terms JUDGE-L1 ' + link);""")

# hold_scope_and_release: positive search control.
r("""    assert.deepEqual(await search(harriet, 'Insurer letter'), []);
    assert.equal((await replay(sian,""",
  """    assert.deepEqual(await search(harriet, 'Insurer letter'), []);
    assert.ok((await search(harriet, 'Hold child JUDGE-H1')).some(t => t.includes('Hold child JUDGE-H1')));
    assert.equal((await replay(sian,""")

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
