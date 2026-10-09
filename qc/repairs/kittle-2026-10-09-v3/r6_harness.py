"""Bring the scripted golden harness in line with the r6 criteria fixes (run from qc/repairs/kittle-2026-10-08)."""
p = 'tests/functional.cjs'
s = open(p, encoding='utf8').read()


def r(a, b):
    global s
    assert s.count(a) == 1, a[:90]
    s = s.replace(a, b)


# wall_added_live now walls and lifts Sian on M-12.
start = s.index("  await check('wall_added_live', async () => {")
end = s.index("  await check('nested_replies', async () => {")
s = s[:start] + """  await check('wall_added_live', async () => {
    await home(sian); await openMatter(sian, 'M-12'); sian.requests.length = 0;
    await post(sian, 'Before wall JUDGE-WL0');
    const preq = lastReq(sian, 'POST', /\\/messages$/);
    await home(harriet); await openMatter(harriet, 'M-12'); harriet.requests.length = 0;
    await harriet.selectOption('#wall-select', 'sian@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Sian'));
    await harriet.locator('#wall-list button', { hasText: 'Lift wall' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#wall-list').textContent.includes('Sian'));
    const liftReq = lastReq(harriet, 'POST', /\\/walls$/);
    await harriet.selectOption('#wall-select', 'sian@kittle.test'); await harriet.click('#wall-add');
    await harriet.waitForFunction(() => document.querySelector('#wall-list').textContent.includes('Sian'));
    await sian.waitForFunction(() => !document.querySelector('#matter-list').textContent.includes('M-12') && /Not available/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    assert.equal((await replay(sian, { ...preq, body: JSON.stringify({ body: 'Too late JUDGE-WL1', client_key: 'wl1' }) })).status, 404);
    assert.ok(!JSON.stringify((await api(harriet, 'GET', '/api/matters/M-12')).data).includes('JUDGE-WL1'));
    assert.ok([403, 404].includes((await replay(sian, liftReq)).status));
    assert.equal((await api(sian, 'GET', '/api/matters/M-12')).status, 404);
    await harriet.locator('#wall-list button', { hasText: 'Lift wall' }).click();
    await harriet.waitForFunction(() => !document.querySelector('#wall-list').textContent.includes('Sian'));
    await sian.reload(); await sian.waitForSelector('.matter-link'); await openMatter(sian, 'M-12');
    assert.equal(await msgLi(sian, 'Before wall JUDGE-WL0').count(), 1);
    await home(sian); await home(harriet);
  });

""" + s[end:]

# timer_changes leg 5: Sian replays with the timer off.
r("""    assert.equal((await replay(sian, { ...treq, body: JSON.stringify({ days: 1 }) })).status, 403);""",
  """    assert.equal((await replay(sian, { ...treq, body: JSON.stringify({ days: null }) })).status, 403);""")

# Polish escape_closes: its own message; an escaped reply posts nothing.
start = s.index("  await check('polish_escape_closes', async () => {")
end = s.index("  await check('polish_delete_confirm', async () => {")
s = s[:start] + """  await check('polish_escape_closes', async () => {
    await post(gwen, 'Escape check JUDGE-K3');
    await msgLi(gwen, 'Escape check JUDGE-K3').locator('button', { hasText: /^Edit$/ }).click();
    await gwen.fill('#composer-input', 'Escaped edit JUDGE-K3'); await gwen.press('#composer-input', 'Escape');
    assert.ok(await gwen.locator('#composer-context').isHidden());
    await gwen.reload(); await gwen.waitForSelector('.matter-link'); await openMatter(gwen, 'M-13');
    assert.equal(await msgLi(gwen, 'Escape check JUDGE-K3').locator('.edited').count(), 0);
    assert.ok(!(await gwen.locator('#thread').innerText()).includes('Escaped edit'));
    await msgLi(gwen, 'Escape check JUDGE-K3').locator('button', { hasText: /^Reply$/ }).click();
    assert.ok(await gwen.locator('#composer-context').isVisible());
    await gwen.fill('#composer-input', 'Escaped reply JUDGE-K3'); await gwen.press('#composer-input', 'Escape');
    assert.ok(await gwen.locator('#composer-context').isHidden());
    await gwen.reload(); await gwen.waitForSelector('.matter-link'); await openMatter(gwen, 'M-13');
    assert.ok(!(await gwen.locator('#thread').innerText()).includes('Escaped reply'));
  });
""" + s[end:]

open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
