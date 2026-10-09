"""Bring the scripted golden harness in line with the v3 criteria (run from qc/repairs/kittle-2026-10-08)."""
p = 'tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# Header and helpers: delete now confirms; edits, mentions list and typing helpers.
r("// Scripted golden checks that follow Kittle's constraints gate, its 16 functional\n// criteria and the polish refusal check step by step,",
  "// Scripted golden checks that follow Kittle's constraints gate, its 16 functional\n// criteria and the polish checks step by step,")
r("""async function del(page, text) {
  await msgLi(page, text).locator('button', { hasText: /^Delete$/ }).click();
""", """async function del(page, text) {
  await msgLi(page, text).locator('button', { hasText: /^Delete$/ }).click();
  await msgLi(page, text).locator('button', { hasText: 'Yes, delete' }).click();
""")
r("""async function copyLink(page, text) {""",
  """async function editMsg(page, text, next) {
  await msgLi(page, text).locator('button', { hasText: /^Edit$/ }).click();
  await page.fill('#composer-input', next); await page.click('#composer-send');
  await page.waitForFunction(t => [...document.querySelectorAll('#thread .message .body')].some(b => b.textContent.includes(t)), next);
  await sleep(150);
}
async function mentionsText(page) {
  await home(page); await page.click('#mentions-link');
  await page.waitForFunction(() => !document.querySelector('#mentions-view').hidden);
  await sleep(500);
  return page.locator('#mentions-view').innerText();
}
async function suggestionsFor(page) {
  await page.fill('#composer-input', ''); await page.type('#composer-input', '@');
  await page.waitForSelector('#mention-suggest:not([hidden])', { timeout: 5000 });
  return page.locator('#mention-suggest').innerText();
}
async function copyLink(page, text) {""")

# wall_every_route leg 5: a reply aimed across matters is refused.
r("""    await dev.goto(B + '/transcripts/M-12'); assert.ok((await dev.locator('body').innerText()).includes('Not available'));
    await home(dev);
  });""", """    await dev.goto(B + '/transcripts/M-12'); assert.ok((await dev.locator('body').innerText()).includes('Not available'));
    const w0 = (await replay(sian, load)).data.messages.find(m => m.body.includes('Wall check JUDGE-W0')).id;
    await home(dev); await openMatter(dev, 'M-11'); dev.requests.length = 0;
    await reply(dev, 'Rent review meeting moved to the afternoon.', 'Reply check JUDGE-W1');
    assert.equal(await depthOf(dev, 'Reply check JUDGE-W1'), 1);
    const rreq = lastReq(dev, 'POST', /\\/messages$/);
    const cross = { ...JSON.parse(rreq.body), body: 'Cross reply JUDGE-W2', parent_id: w0, client_key: 'w2' };
    assert.ok((await replay(dev, { ...rreq, body: JSON.stringify(cross) })).status >= 400, 'cross reply refused');
    for (const [pg, id] of [[dev, 'M-11'], [harriet, 'M-11'], [sian, 'M-12']]) assert.ok(!JSON.stringify((await api(pg, 'GET', `/api/matters/${id}`)).data).includes('JUDGE-W2'), id);
    await home(dev);
  });""")

# wall_mentions_and_links: lower-case mention, then Part B suggestions.
r("""    await post(harriet, '@Dev survey update JUDGE-M2');""", """    await post(harriet, '@dev survey update JUDGE-M2');""")
r("""    assert.ok(texts.includes('JUDGE-M2') && !texts.includes('JUDGE-M1') && !texts.includes('M-12'), texts);
    await home(dev);
  });""", """    assert.ok(texts.includes('JUDGE-M2') && !texts.includes('JUDGE-M1') && !texts.includes('M-12'), texts);
    await home(harriet); await openMatter(harriet, 'M-12'); harriet.requests.length = 0;
    const s12 = await suggestionsFor(harriet);
    assert.ok(s12.includes('Sian Lloyd') && s12.includes('Paul Marsh') && !s12.includes('Dev') && !s12.includes('Gwen'), s12);
    const sugReq = lastReq(harriet, 'GET', /\\/people$/);
    await harriet.fill('#composer-input', '');
    await openMatter(harriet, 'M-11');
    const s11 = await suggestionsFor(harriet);
    assert.ok(s11.includes('Dev Anand') && s11.includes('Sian Lloyd') && s11.includes('Gwen Pryce') && !s11.includes('Paul'), s11);
    await harriet.locator('#mention-suggest button', { hasText: 'Dev Anand' }).click();
    await harriet.type('#composer-input', 'suggestion check JUDGE-M3');
    assert.equal(await harriet.inputValue('#composer-input'), '@Dev suggestion check JUDGE-M3');
    await harriet.click('#composer-send');
    await harriet.waitForFunction(() => document.querySelector('#thread').textContent.includes('JUDGE-M3'));
    assert.ok((await mentionsText(dev)).includes('JUDGE-M3'), 'picked mention reaches Dev');
    const dr = await replay(dev, sugReq);
    assert.ok(dr.status === 404 && !/Sian|Paul|Harriet|Marsh/.test(JSON.stringify(dr.data)), JSON.stringify(dr));
    await home(dev);
  });""")

# timer_changes: Harriet edits the nine-day-old message before shortening.
r("""    const vreq = lastReq(harriet, 'GET', /\\/versions$/);
    harriet.requests.length = 0;
    await setTimer(harriet, '7');""", """    const vreq = lastReq(harriet, 'GET', /\\/versions$/);
    await editMsg(harriet, 'Costs estimate sent to Gwen.', 'Costs estimate sent to Gwen JUDGE-TE');
    assert.equal(await msgLi(harriet, 'JUDGE-TE').locator('.edited').count(), 1);
    harriet.requests.length = 0;
    await setTimer(harriet, '7');""")
r("""    assert.ok(!text.includes('Probate estimate'));
    assert.equal(await msgLi(harriet, 'My executor').locator('.hold-badge').count(), 1);""",
  """    assert.ok(!text.includes('Probate estimate') && !text.includes('JUDGE-TE'));
    assert.equal(await msgLi(harriet, 'My executor').locator('.hold-badge').count(), 1);""")
r("""    for (const q of ['Probate', '2,400', '4,200']) assert.deepEqual(await search(harriet, q), []);""",
  """    for (const q of ['Probate', '2,400', '4,200', 'JUDGE-TE']) assert.deepEqual(await search(harriet, q), []);""")
r("""    assert.ok(!t.includes('2,400') && !t.includes('4,200') && t.includes('My executor will be my sister.'));""",
  """    assert.ok(!t.includes('2,400') && !t.includes('4,200') && !t.includes('JUDGE-TE') && t.includes('My executor will be my sister.'));""")

# hold: deleting the held message goes through the confirmation, then is refused.
r("""    await msgLi(harriet, 'Hold child JUDGE-H1').locator('button', { hasText: /^Delete$/ }).click();
    await harriet.waitForFunction(""", """    await msgLi(harriet, 'Hold child JUDGE-H1').locator('button', { hasText: /^Delete$/ }).click();
    await msgLi(harriet, 'Hold child JUDGE-H1').locator('button', { hasText: 'Yes, delete' }).click();
    await harriet.waitForFunction(""")

# edits_and_stale_edit Part B: mentions follow edits and deletes.
r("""    assert.ok(at > 0 && /edited/.test(t.slice(Math.max(0, at - 600), at + 200)));
  });""", """    assert.ok(at > 0 && /edited/.test(t.slice(Math.max(0, at - 600), at + 200)));
    await home(harriet); await openMatter(harriet, 'M-13');
    await post(harriet, 'Plain note JUDGE-ME1');
    assert.ok(!(await mentionsText(dev)).includes('JUDGE-ME1'));
    await editMsg(harriet, 'Plain note JUDGE-ME1', '@Dev plain note JUDGE-ME1');
    assert.ok((await mentionsText(dev)).includes('JUDGE-ME1'), 'edited-in mention');
    await editMsg(harriet, '@Dev plain note JUDGE-ME1', 'Plain note JUDGE-ME1 done');
    assert.ok(!(await mentionsText(dev)).includes('JUDGE-ME1'), 'edited-out mention');
    await post(harriet, '@Dev short lived JUDGE-ME2');
    assert.ok((await mentionsText(dev)).includes('JUDGE-ME2'));
    await del(harriet, 'short lived JUDGE-ME2');
    assert.ok(!(await mentionsText(dev)).includes('JUDGE-ME2'), 'deleted mention');
  });""")

# search_and_transcript Part C: literal % and _.
r("""    assert.ok(k2.includes('On hold') && /edited/.test(k2) && t.includes('Landlords notice recieved.'), 'held edited versions');
  });""", """    assert.ok(k2.includes('On hold') && /edited/.test(k2) && t.includes('Landlords notice recieved.'), 'held edited versions');
    await home(gwen); await openMatter(gwen, 'M-11');
    for (const m of ['Deposit is 100% JUDGE-Q1', 'Deposit is 1000 pounds JUDGE-Q2', 'Ref A_1 JUDGE-Q3', 'Ref AB1 JUDGE-Q4']) await post(gwen, m);
    const tags = async q => (await search(gwen, q)).map(x => (x.match(/JUDGE-Q\\d/) || [''])[0]).filter(Boolean).join(',');
    assert.equal(await tags('100%'), 'JUDGE-Q1');
    assert.equal(await tags('A_1'), 'JUDGE-Q3');
    assert.equal(await tags('1000 pounds'), 'JUDGE-Q2');
  });""")

# Polish: the new interaction checks run after the restart, like the judge's polish pass.
r("""  await check('polish_transcript_phone', async () => {""", """  const gwen = await ctx(); await signIn(gwen, 'gwen@kittle.test');
  await check('polish_enter_sends', async () => {
    await openMatter(gwen, 'M-13');
    await gwen.click('#composer-input');
    await gwen.keyboard.type('Enter check JUDGE-K1'); await gwen.keyboard.press('Shift+Enter');
    await gwen.keyboard.type('second line JUDGE-K1');
    assert.equal(await msgLi(gwen, 'JUDGE-K1').count(), 0, 'Shift+Enter did not send');
    await gwen.keyboard.press('Enter');
    await gwen.waitForFunction(() => document.querySelector('#thread').textContent.includes('second line JUDGE-K1'));
    assert.equal(await gwen.locator('#thread li.message .body', { hasText: 'JUDGE-K1' }).count(), 1);
    assert.ok((await msgLi(gwen, 'Enter check JUDGE-K1').locator('.body').innerText()).includes('Enter check JUDGE-K1\\nsecond line JUDGE-K1'));
    assert.equal(await gwen.inputValue('#composer-input'), '');
  });
  await check('polish_escape_closes', async () => {
    await msgLi(gwen, 'Enter check JUDGE-K1').locator('button', { hasText: /^Edit$/ }).click();
    await gwen.fill('#composer-input', 'Escaped edit JUDGE-K1'); await gwen.press('#composer-input', 'Escape');
    assert.ok(await gwen.locator('#composer-context').isHidden());
    await gwen.reload(); await gwen.waitForSelector('.matter-link'); await openMatter(gwen, 'M-13');
    assert.equal(await msgLi(gwen, 'Enter check JUDGE-K1').locator('.edited').count(), 0);
    assert.ok(!(await gwen.locator('#thread').innerText()).includes('Escaped edit'));
    await msgLi(gwen, 'Enter check JUDGE-K1').locator('button', { hasText: /^Reply$/ }).click();
    assert.ok(await gwen.locator('#composer-context').isVisible());
    await gwen.press('#composer-input', 'Escape');
    assert.ok(await gwen.locator('#composer-context').isHidden());
  });
  await check('polish_delete_confirm', async () => {
    await post(gwen, 'Confirm check JUDGE-K2');
    await msgLi(gwen, 'Confirm check JUDGE-K2').locator('button', { hasText: /^Delete$/ }).click();
    assert.ok((await msgLi(gwen, 'Confirm check JUDGE-K2').innerText()).includes('Delete this message?'));
    await msgLi(gwen, 'Confirm check JUDGE-K2').locator('button', { hasText: 'Keep it' }).click();
    await gwen.reload(); await gwen.waitForSelector('.matter-link'); await openMatter(gwen, 'M-13');
    assert.equal(await msgLi(gwen, 'Confirm check JUDGE-K2').count(), 1);
    await del(gwen, 'Confirm check JUDGE-K2');
  });
  await check('polish_link_highlight', async () => {
    await search(gwen, 'Survey booked');
    await gwen.locator('#results a', { hasText: 'Survey booked for Friday.' }).click();
    await gwen.waitForFunction(() => location.pathname === '/matters/M-11' && document.querySelector('#msg-K-3.focused'));
    await sleep(10000);
    assert.equal(await gwen.locator('#msg-K-3.focused').count(), 1);
    assert.ok(await gwen.locator('#msg-K-3').isVisible());
    const bg = await gwen.locator('#msg-K-3').evaluate(el => getComputedStyle(el).boxShadow);
    assert.ok(bg && bg !== 'none');
  });
  await check('polish_transcript_phone', async () => {""")

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
