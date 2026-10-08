"""Bring the scripted golden harness in line with the round r4 criteria fixes."""
p = 'tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# signin_and_client_scope Part A: mention and search positive controls, matter-list replay.
r("""  await check('signin_and_client_scope', async () => {
    const titles = await gwen.locator('.matter-link').allTextContents();""",
  """  await check('signin_and_client_scope', async () => {
    await home(harriet); await openMatter(harriet, 'M-11');
    await post(harriet, '@Gwen please check JUDGE-CS0');
    gwen.requests.length = 0;
    await home(gwen);
    const lreq = lastReq(gwen, 'GET', /\\/api\\/matters$/);
    const titles = await gwen.locator('.matter-link').allTextContents();""")
r("""    await gwen.click('#mentions-link'); await sleep(500);
    const mreq = lastReq(gwen, 'GET', /\\/api\\/mentions/);
    await search(gwen, 'Survey');""",
  """    await gwen.click('#mentions-link'); await sleep(500);
    assert.ok((await gwen.locator('#mentions-view').innerText()).includes('JUDGE-CS0'), 'mention shown');
    const mreq = lastReq(gwen, 'GET', /\\/api\\/mentions/);
    assert.ok((await search(gwen, 'Survey')).some(t => t.includes('Survey booked for Friday.')));""")
r("""    for (const q of [load, mreq, sreq]) {""", """    for (const q of [lreq, load, mreq, sreq]) {""")

# Part B: Harriet's recorded M-12 request is the one Gwen replays.
r("""    assert.equal((await replay(gwen, { ...load, url: load.url.replace('M-11', 'M-12') })).status, 404);""",
  """    harriet.requests.length = 0; await openMatter(harriet, 'M-12');
    const h12 = lastReq(harriet, 'GET', /\\/api\\/matters\\/M-12$/);
    assert.equal((await replay(gwen, h12)).status, 404);""")

# wall_every_route: Sian's matter-list request replayed as Dev.
r("""    await openMatter(sian, 'M-11'); await openMatter(sian, 'M-12');
    const load = lastReq(sian, 'GET', /\\/api\\/matters\\/M-12$/);""",
  """    await home(sian); await openMatter(sian, 'M-11'); await openMatter(sian, 'M-12');
    const slist = lastReq(sian, 'GET', /\\/api\\/matters$/);
    const load = lastReq(sian, 'GET', /\\/api\\/matters\\/M-12$/);""")
r("""    assert.equal((await replay(dev, load)).status, 404);""",
  """    assert.equal((await replay(dev, load)).status, 404);
    const dl = JSON.stringify((await replay(dev, slist)).data);
    assert.ok(!dl.includes('M-12') && !dl.includes('Marsh'), 'matter list replay');""")

# Polish: transcript readable at phone width.
r("""  await check('polish_refusal_in_place', async () => {""",
  """  await check('polish_transcript_phone', async () => {
    const p = await ctx(); await p.setViewportSize({ width: 390, height: 844 });
    await signIn(p, 'gwen@kittle.test');
    await p.goto(B + '/transcripts/M-11');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
    await p.context().close();
  });
  await check('polish_refusal_in_place', async () => {""")

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
